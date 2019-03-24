const requestData = async () => {

  // Helpers
  var roundNumber = d3.format(".5g");

  //Storage for our dataset
  var points = [];

  // Taken from our data files
  let predictedVariable = "PISA";
  let inputVariables = ["Income", "Inequality", "EduSpend", "HDI"];
  // Storage for mean/stdev for sliders
  let variableMean = {};
  let variableStdDev = {};

  // Model -- this time with many input variables, start zeroed
  function startingModel () {
    let model = { intercept: 0.0 };

    inputVariables.forEach(function (variable) {
    	model[variable] = 0.0;
    });

    return model;
  }
  var model = startingModel();


  // Update the residuals for our points using the linear model
  function updateResiduals(points, model) {
    points.forEach(function (point) {
      point["prediction"] = 0.0;
      inputVariables.forEach(function (variable) {
        // Y = b1*x1 + b2*x2... + b
        point["prediction"] += model[variable] * point[variable];
      });
      // ... + b
      point["prediction"] += model.intercept;

      // Real Y minus our current guess
      point.residual = point[predictedVariable] - point["prediction"];
    });
  }
  updateResiduals(points, model);

  // Compute squared loss
  function squaredError() {
    return d3.sum(points, function (point) {
      return point.residual * point.residual;
    });
  }
  var lossFunction = squaredError;

  // Draw SVG plot of our predictions vs actual value
  let height = 430;
  let width = 430;
  let svg = d3.select("#plot").append("svg").attr("width",width).attr("height",height);
  let margin = { top: 10, right: 10, bottom: 50, left:50};
  let chartWidth = width - margin.left - margin.right;
  let chartHeight = height - margin.top - margin.bottom;

  // Let's hardcode an area of interest for PISA scores
  let extent = [100, 700];

  let xScale = d3.scaleLinear().domain(extent).range([0, chartWidth]);
  let xAxis = d3.axisBottom(xScale);
  svg.append("g")
    .attr("class", "x axis")
    .attr("transform","translate("+margin.left+","+(chartHeight + margin.top+5)+")")
    .call(xAxis);
  svg.append("text").attr("x", chartWidth / 2).attr("y", chartHeight+50).text("Predicted PISA");

  let yScale = d3.scaleLinear().domain(extent).range([chartHeight, 0]);
  let yAxis = d3.axisLeft(yScale);
  svg.append("g")
    .attr("class", "y axis")
    .attr("transform","translate("+(margin.left-5)+","+margin.top+")")
    .call(yAxis);
  svg.append("text").attr("transform", "rotate(90)")
    .attr("x", chartHeight/2).attr("y", 0).text("Actual PISA");

  // Add a line to indicate perfect results (identity function)
  var chart = svg.append("g").attr("transform","translate("+margin.left+","+margin.top+")");
  let identityLine = chart.append("line")
        .attr("class", "estimated")
        .attr("x1", xScale(extent[0]))
        .attr("y1", yScale(extent[0]))
        .attr("x2", xScale(extent[1]))
        .attr("y2", yScale(extent[1]))
        .style("stroke", "#ba2426");

  var modelText = chart.append("text")
    .attr("id", "status")
    .attr("x", 10).attr("y", 30)
    .text("Squared Error: " + roundNumber(lossFunction()));

  var mouseoverLabel = chart.append("text");

  var modelSummary = d3.select("#summary");
  function updateSummary(model) {
    let t = roundNumber(model.intercept);
    inputVariables.forEach( d => {
      t = t + " + " + roundNumber(model[d]) + "*" +  d;
    });
    modelSummary.text(t);
  };
  updateSummary(model);


  // Import data
  const raw_pisa      = await d3.tsv("../datasets/pisa.txt");
  const raw_gdp       = await d3.tsv("../datasets/gdp.txt");
  const raw_education = await d3.tsv("../datasets/education.txt");
  const raw_gini      = await d3.tsv("../datasets/gini.txt");
  const raw_hdi       = await d3.tsv("../datasets/hdi.txt");

  // Construct our dataset by merging all of these files together
  //   Verify that the nest commands are all working
  const gdp       = d3.nest().key(function (d) { return d.Country.trim(); }).map(raw_gdp);
  const education = d3.nest().key(function (d) { return d.Country.trim(); }).map(raw_education);
  const gini      = d3.nest().key(function (d) { return d.Country.trim(); }).map(raw_gini);
  const hdi       = d3.nest().key(function (d) { return d.Country.trim(); }).map(raw_hdi);


  let filterList = ["Singapore", "Hong Kong", "Malta", "United Arab Emirates", "Montenegro", "Lebanon"];


  raw_pisa.forEach(function (d) {
    let countryName = d.Country.trim();

    if (filterList.indexOf(countryName) === -1) {

      // We'll wrap this in a try block in case our data processing tasks fail
      try {
          d["PISA"] = parseFloat(d["PISA"]); // For clarity

          d["Income"] = Math.log(parseFloat(gdp.get(countryName)[0]["GDP"].replace(/,/g,""))) ;
          d["EduSpend"] = parseFloat(education.get(countryName)[0]["Education"]);
          d["Inequality"] = parseFloat(gini.get(countryName)[0]["WBGini"]);
          d["HDI"] = parseFloat(hdi.get(countryName)[0]["HDI"]);
          console.log(d);

          // Only add the point if we make it all the way to the end
          points.push(d);
      }
      catch (error) {
        console.log("problem with '" + countryName + "'");
        console.log(error);
      }
    }

  });
  console.log(points);



  // Start our model at the mean of our starting coefficients
  model.intercept = d3.mean(points, function (d) { return d[predictedVariable]; });

  // Make the sliders for configuring the model
  var slidersDiv = d3.select("#plot").append("div").style("float", "right"); // Floats are dangerous!

  slidersDiv.append("div").text("Intercept")
    .append("div").append("input")
    .attr("type", "range").attr("class", "slider")
    .attr("id","intercept")
    .style("width","300px")
    .attr("min", model.intercept - 500)
    .attr("max", model.intercept + 500).attr("step", 2)
    .attr("value", model.intercept)
    .on("input", function () {
      // Whenever the slider changes, update intercept and chart
      model.intercept = Number(this.value);
      updateChart();
    });

  // For each of our input variables, add a slider
  inputVariables.forEach(function (variable) {

    variableMean[variable] = d3.mean(points, function (d) { return d[variable]; });
    variableStdDev[variable] = d3.deviation(points, function (d) { return d[variable]; });

    // Create a range for the slider
    var varMin = -30 / variableStdDev[variable];
    var varMax = 30 / variableStdDev[variable];
    var step = (varMax - varMin) / 100; // 100 steps over the whole slider range
    slidersDiv
      .append("div").text(variable)
      .append("div").append("input")
      .attr("type", "range").attr("class", "slider")
      .attr("id",variable)
      .style("width","300px")
      .attr("min", varMin)
      .attr("max", varMax)
      .attr("step", step)
      .attr("value", model[variable])
      .on("input", function () {
          // Whenever the slider changes, update coefficient and chart
          model[variable] = Number(this.value);
          updateChart();
      });

  });

  updateChart();


  function updateChart() {
    updateResiduals(points, model);
    updateSummary(model);

    // Data join to update the circles based on our model
    var circles = chart.selectAll("circle").data(points);

    circles.enter()
      .append("circle")
      .attr("r", 5)
      .style("opacity", 0.4)
      .on("click", function (d) {
        mouseoverLabel.attr("x", xScale(d["prediction"]))
          .attr("y", yScale(d[predictedVariable]))
          .text(d.Country);
      })
      .merge(circles) // Bring in ones that already exist
      .attr("country", d => d.Country)
      .attr("cx", function (d) { return xScale(d["prediction"]); })
      .attr("cy", function (d) { return yScale(d[predictedVariable]); });

    modelText.text("Loss: " + roundNumber(lossFunction()));
  }


  }
  requestData();