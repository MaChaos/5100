const svg = d3.select("#choropleth");
  const width = svg.attr("width");
  const height = svg.attr("height");
  const margin = { top: 20, right: 20, bottom: 20, left:20};
  const mapWidth = width - margin.left - margin.right;
  const mapHeight = height - margin.top - margin.bottom;
  const map = svg.append("g")
                  .attr("transform","translate("+margin.left+","+margin.top+")");

  // 1. Let's explore a new way to use promises for data imports that might be a bit cleaner when importing lots of files

  const requestData = async () => {

    // 2. Draw a map of US using topoJSON
    // 2a. Import data as synchronous call to topoJSON data file
    // Care of Mike Bostock:
    //   "../datasets/us.json"
    //   "../datasets/us-state-names.tsv"

    const us = await d3.json("../datasets/us.json");
    console.log(us);

    // 2b. Pick out topographic features and build d3 helpers
    var states = topojson.feature(us, us.objects.states);
    var statesMesh = topojson.mesh(us, us.objects.states);
    var projection = d3.geoAlbersUsa().fitSize([mapWidth, mapHeight], states);
    var path = d3.geoPath().projection(projection);

    // 2c. Draw states and outlines
    map.selectAll("path").data(states.features)
        .enter()
        .append("path")
        .attr("class","state")
        .attr("d", path);
        // .attr("note", d => d.id);  // We used this for debugging

    map.append("path")
      .datum(statesMesh)
      .attr("class","outline")
      .attr("d", path);

    // 3a. Import survey data as synchronous calls
    // "../datasets/state_survey_options.csv"
    // "../datasets/US States & Territories (Responses) - Form Responses 1.csv"
    const surveyData = await d3.csv("../datasets/US States & Territories (Responses) - Form Responses 1.csv");
    console.log(surveyData);

    const stateIDs = await d3.tsv("../datasets/us-state-names.tsv");
    console.log(stateIDs);


    // 3b. Generate the counts we will need
    let stateCounts = {};
    let idToState = {};
    stateIDs.forEach( row => {
      stateCounts[row.name] = 0;
      idToState[row.id] = row.name;
    });
    surveyData.forEach( row => {
      let splitRow = row.Boxes.split(", ");
      splitRow.forEach( state => {
        stateCounts[state] += 1;
      });
    });
    console.log(stateCounts);


    // 3c. Make a d3 color scale for frequency, first using d3.interpolateGnBu
    // ["#fff","#f6fbfc","#adc2da","#8879b3","#762b80"]
    // ["#f6fbfc","#adc2da","#8879b3","#762b80"]

    const minMax = d3.extent(stateIDs, d => stateCounts[d.name]);
    console.log(minMax);
    //const colorScale = d3.scaleSequential(d3.interpolateGnBu).domain(minMax);
    const colorScale = d3.scaleQuantile()
                          .domain(d3.values(stateCounts))
                          .range(["#fff","#f6fbfc","#adc2da","#8879b3","#762b80"]);
    // const colorScale = d3.scaleQuantize()
    //                       .domain(minMax)
    //                       .range(["#f6fbfc","#adc2da","#8879b3","#762b80"]);

    // 3d. Recolor the states to make a choropleth
    map.selectAll(".state")
        .style("fill", d => colorScale( stateCounts[ idToState[d.id] ] ));




    // Bonus code here to draw an adaptive gradient legend so we can see different color scales for choropleth maps
    //  Credit Prof. Rz if you are basing a legend on this structure, and note performance issues
    const legend = d3.select("#colorLegend");
    const legendWidth = legend.attr("width");
    const legendHeight = legend.attr("height");
    const barHeight = 60;
    const stepSize = 4; // warning, not using a canvas element so lots of rect tags will be created for low stepSize, causing issues with performance
    // Use minMax from step 3c, but extend range by 1 in either direction to expose more features
    const pixelScale = d3.scaleLinear().domain([0,legendWidth-40]).range([minMax[0]-1,minMax[1]+1]); // In this case the "data" are pixels, and we get numbers to use in colorScale
    const barScale = d3.scaleLinear().domain([minMax[0]-1,minMax[1]+1]).range([0,legendWidth-40]);
    const barAxis = d3.axisBottom(barScale);
    legend.append("g")
      .attr("class", "colorbar axis")
      .attr("transform","translate("+(20)+","+(barHeight+5)+")")
      .call(barAxis);
    // Draw rects of color down the bar
    let bar = legend.append("g").attr("transform","translate("+(20)+","+(0)+")")
    for (let i=0; i<legendWidth-40; i=i+stepSize) {
      bar.append("rect")
        .attr("x", i)
        .attr("y", 0)
        .attr("width", stepSize)
        .attr("height",barHeight)
        .style("fill", colorScale( pixelScale(i) )); // pixels => countData => color
    }
    // Put lines in to mark actual min and max of our data
    bar.append("line").attr("stroke","white").attr("stroke-width",3).attr("x1", barScale(minMax[0])).attr("x2", barScale(minMax[0])).attr("y1", 0).attr("y1", barHeight+4);
    bar.append("line").attr("stroke","white").attr("stroke-width",3).attr("x1", barScale(minMax[1])).attr("x2", barScale(minMax[1])).attr("y1", 0).attr("y1", barHeight+4);

  };

  requestData();
