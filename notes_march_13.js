const requestData = async () => {

  // Data originally in GeoJSON form on the WPRDC (https://data.wprdc.org/dataset/neighborhoods1)
  //  Converted to topoJSON, which reduced file size from 1.3mB to 250kB.
  const pgh = await d3.json("../datasets/pittsburgh_neighborhoods.json");
  console.log(pgh);

  var map = d3.select("#map_canvas");
  var mapWidth = map.attr("width");
  var mapHeight = map.attr("height");

  // Draw a mesh so we have a background for our house locations
  var pghMesh = topojson.mesh(pgh, pgh.objects.Neighborhoods_);
  var projection = d3.geoMercator().fitSize([mapWidth, mapHeight], pghMesh);
  var path = d3.geoPath().projection(projection);

  map.append("path")
    .datum(pghMesh)
    .attr("class","outline")
    .attr("d", path);


  // Load data file and draw some circles using a data join
  //  This time we are using a new d3 capability, a _row conversion function_
  //  We feed in d3.autoType, a helper conversion function that handles simple
  //   things like dates, numbers, etc. It panics often and reverts to string
  //   if things do not convert easily, so there is still cleanup
  const houses = await d3.csv("../datasets/pgh_homes.csv", d3.autoType);

  // Cleanup
  houses.forEach( d => {
    // The plus here does a simple number conversion (doesn't handle things like "px")
    d["Sale Price"] = +d["Sale Price"].replace(/[,\$]/g,"").trim();
    // While we're at it, get position using the projection
    d["position"] = projection([d.Longitude, d.Latitude]);
  });
  console.log(houses);

  map.selectAll("circle").data(houses)
          .enter()
          .append("circle")
          .attr("r", 4)
          .attr("opacity", 0.7)
          .attr("cx", d => d.position[0])
          .attr("cy", d => d.position[1]);


  // 0. Helper functions for filtering our data as we go
  // First, a dict that maps a specific attribute to a function that takes in a datapoint
  //  and returns true if that particular point meets its filter criteria
  //   e.g. d => d["Sale Price"] > 1000 && d["Sale Price"] < 700000
  var currentFilters = {};

  // Function to test a given point against the whole set of filters
  function evalFilters(d) {

    let metCriteria = true;
    d3.values(currentFilters).forEach( filter => {

      metCriteria = filter(d) && metCriteria;

    } );
    return metCriteria;

  }

  // Function to go through all filters and update the appearance of every circle
  //  Since we used a data join here, we can set opacity directly rather than use forEach
  function updateFilterAppearance() {

    map.selectAll("circle")
          .attr("opacity", d => (evalFilters(d)) ? 0.7 : 0.1)
          .attr("stroke", d => (evalFilters(d)) ? "black" : "none")

  }
  updateFilterAppearance();



  // 1. Make a function to construct dynamic query sliders and add them to the panel
  function makeSlider(property) {

    // 1a. Get a raw array of values for this property
    let values = houses.map(d => d[property]);
    let minMax = d3.extent(values);

    // 1b. Gather data to power the slider viz elements
    let sliderWidth = parseFloat( d3.select("#controls").style("width") );
    let sliderHeight = 60;

    let xScale = d3.scaleLinear().domain(minMax).range([10, sliderWidth-10]);
    let xAxis = d3.axisBottom(xScale).tickFormat(d3.format(".2s"));

    let container = d3.select("#controls").append("div").attr("class","control");
    let label = container.append("div").text(property);
    let canvas = container.append("svg").attr("width",sliderWidth).attr("height",sliderHeight);
    let histoLayer = canvas.append("g");
    let axisLayer = canvas.append("g")
                  .attr("transform","translate("+0+","+(sliderHeight-18)+")")
                      .call(xAxis);



    // 1c. For better UX, we can make sliders that show the distribution of data
    // Easiest might be to just do jittered circles -- but we can do better!
    // Let's make a smoothed histogram by applying a curved interpolator to a few bins
    // We could also use kernel density estimation or a moving average

    // We can start by making a simple <rect> based histogram
    //  Using the histogram helper function to "bin" everything up for us.
    let numBins = 10;
    let counts = d3.histogram().domain( minMax ).thresholds( numBins )(values);
    console.log(counts);

    let yScale = d3.scaleLinear().domain( d3.extent(counts, d=>d.length) )
                                 .range([sliderHeight-18, 5]);
    //
    // histoLayer.selectAll("rect").data(counts)
    //             .enter().append("rect")
    //             .attr("x", d => xScale(d.x0))
    //             .attr("y", d => yScale(d.length))
    //             .attr("width", d => xScale(d.x1) - xScale(d.x0))
    //             .attr("height", d => (sliderHeight-18) - yScale(d.length))
    //             .style("fill", "steelblue")
    //             .style("stroke", "black")

    // On Monday we will make something more for 2019 than 1998

    // 1d. d3.area is a generator just like d3.line, but it takes in y0 and y1 so it can
    //      make a filled region underneath the line

    // As demo-ed in class using the x1 point
    // let area = d3.area().x( d => xScale(d.x1) )
    //                     .y0( yScale(0) )
    //                     .y1( d => yScale( d.length ) )
    //                     .curve(d3.curveNatural);
    // counts.unshift( { x0: 0,
    //                   x1: counts[0].x0,
    //                   length: counts[0].length } );


    // *** Updated version to use midpoints instead of the x1 values
    counts.forEach( d => {
      d.xM = (d.x0+d.x1)/2.0; // compute midpoints
    });
    // Fixes for edges
    counts.unshift( { xM: counts[0].x0, length: counts[0].length } ); // start at first x0
    counts.push( { xM: counts[counts.length-1].x1, length: counts[counts.length-1].length } ); // end at last x1
    // New generator
    let area = d3.area().x( d => xScale(d.xM) )
                        .y0( yScale(0) )
                        .y1( d => yScale( d.length ) )
                        .curve(d3.curveNatural);

    histoLayer.append("path").datum(counts)
                .attr("class","area")
                .attr("d", area);




    // 1e. Allow the user to select regions through d3.brush
    var brush = d3.brushX()
                      .extent(
                        // NOTE: extent takes in only one parameter here --> [[upperleft], [lowerright]]
                        [ [10,0],[sliderWidth-10,sliderHeight-18] ]
                            )
                      .on("brush end", brushMoved); // call function on "brush" and on "end"

    function brushMoved() {

      //console.log(d3.event);

      //we use d3.event because the brush triggers custom d3 events. JS event won't be as useful
      if (d3.event.selection !== null) {

        let start = xScale.invert(d3.event.selection[0]);
        let end = xScale.invert(d3.event.selection[1]);

        let newFilter = d => d[property] >= start && d[property] <= end;
        currentFilters[property] = newFilter;
      }

      else {
        // null happens when we have an "end" event with an empty slider
        //   (e.g. clicking on whitespace to clear)

        let newFilter = function() { return true; }
        currentFilters[property] = newFilter;

      }

      updateFilterAppearance();

      // Check type, if the user is lifting their mouse, then update the data table
      //  We don't want to constantly update it because it can be very distracting for users
      //  (there are good cases to be made for it happening during brush or end
      if (d3.event.type === "end") {
        updateTable();
      }

    }


    // 1f. Add the brush to the canvas

    // brush is useless until you give it a place to live and call it
    canvas.append("g").attr("class","brush")
                        .call(brush);


  }

  makeSlider("Sale Price");
  makeSlider("Bathrooms");
  makeSlider("Bedrooms");
  makeSlider("Lot Size");
  makeSlider("Year Built");




  // 2. Let's also make the map brushable so we can display the rows the user selects

  let mapBrush = d3.brush().extent([ [0,0],
                                     [mapWidth,mapHeight] ])
                           .on("brush end", mapBrushed);

  function mapBrushed() {

    // If the user selects something
    if (d3.event.selection !== null) {
          let start = projection.invert( d3.event.selection[0] );
          let end = projection.invert( d3.event.selection[1] );

          // Compose a filter and add it
          //  We need to use min and max because it is not guaranteed that selection[0] will have the lowest values
          //  This is because the selection is making use of lat/lng as opposed to some absolute data value, for example
          //   lat increases in the northern hemisphere and decreases in the southern hemisphere
          //  Since we are doing numeric comparisons, we need to find the absolute min value (but be careful for larger maps!)

          currentFilters["mapLat"] = d => d.Latitude >= Math.min(start[1],end[1]) &&
                                          d.Latitude <= Math.max(start[1],end[1]);
          currentFilters["mapLon"] = d => d.Longitude >= Math.min(start[0],end[0]) &&
                                          d.Longitude <= Math.max(start[0],end[0]);
          updateFilterAppearance();

    }
    else {
      // Selected nothing, reset the filter
      currentFilters["mapLat"] = d => {return true};
      currentFilters["mapLon"] = d => {return true};
      updateFilterAppearance();

    }

    // Check type, if the user is lifting their mouse, then update the data table
    //  We don't want to constantly update it because it can be very distracting for users
    //  (there are good cases to be made for it happening during brush or end
    if (d3.event.type === "end") {
      updateTable();
    }

  }

  // Function that uses .filter to make a subset of our dataset and then writes some table rows
  function updateTable() {

    let filtered = houses.filter(d => evalFilters(d));

    let rows = d3.select("table#places").selectAll("tr").data(filtered);

    rows.exit().remove();

    rows.enter().append("tr")
        .merge(rows)  // Merge in existing rows so we can affect all of them
        .html("")     // Clear contents of all rows so that we can put in some new <td> elements

    // Add some stuff to the contents of all of the rows (data can percolate down the DOM hierarchy)
    rows.append("td").text(d => "House "+d.Entry);
    rows.append("td").text(d => d3.format("$,")(d["Sale Price"]));
    rows.append("td").text(d => d["Neighborhood"]);


  }
  updateTable();


  map.append("g").attr("class","brush").call(mapBrush);




  };

  requestData();