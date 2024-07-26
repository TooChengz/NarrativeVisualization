var country = '';
var city = '';
var season = 0; // 0 summer, 1 winter. Might not need
var filePath = '';
var sceneCount = 0;
var countryPath = '';
let scenes = [];

var summerDataPath = 'Data/summer.csv'
var gdpDataPath = 'Data/dictionary.csv'
var winterDataPath = 'Data/winter.csv'
// Load the data using d3.csv

let fullDataset = [];  // To store all data with medals


// home button. country list with info, individual medal count and connections, annotation
// function displayDebugInfo() {
//     const infoDiv = document.getElementById("debug-info");
//     if (infoDiv) {
//         infoDiv.innerHTML = `Current Scene Index: ${sceneCount} <br> Total Scenes: ${scenes.length}`;
//     }
// }

function initialize() {
    // Load the data using d3.csv
    Promise.all([
        d3.csv(summerDataPath),
        d3.csv(winterDataPath),
        d3.csv(gdpDataPath)
    ]).then(([summerData, winterData, gdpData]) => {
        // Process and combine data
        fullDataset = processAndCombineData(summerData, winterData, gdpData);
        const combinedData = fullDataset; // Use fullDataset for initial display

        scenes = createScenes(combinedData);
        // Draw the initial timeline
        createTimeline(scenes);
        drawScene(scenes[sceneCount]);
        drawCumulativeBarChart(combinedData, scenes[sceneCount].year); // Initialize the bar chart here
        updateCityInfo(scenes[sceneCount].city); 
        // Display initial debug info
        //displayDebugInfo();
    }).catch(error => {
        console.error('Error loading the data:', error);
    });
    // Add event listeners for filter controls
    d3.selectAll("#medal-filter").on("change", function() {
        updateFilterCharts();
    });
}

function processAndCombineData(summerData, winterData, gdpData) {
    const combinedData = [];

    // Combine summer and winter data
    summerData.forEach(d => combinedData.push({ ...d, Season: 'Summer' }));
    winterData.forEach(d => combinedData.push({ ...d, Season: 'Winter' }));

    // Calculate medal counts and add population data
    const medalCounts = d3.rollup(combinedData, v => ({
        total: v.length,
        gold: v.filter(d => d.Medal === 'Gold').length,
        silver: v.filter(d => d.Medal === 'Silver').length,
        bronze: v.filter(d => d.Medal === 'Bronze').length,
        city: v[0].City
    }), d => d.Year, d => d.Country);

    const dictionary = new Map(gdpData.map(d => [d.Code, d]));

    const processedData = [];
    medalCounts.forEach((countries, year) => {
        countries.forEach((counts, country) => {
            const dictEntry = dictionary.get(country);
            if (dictEntry) {
                processedData.push({
                    Year: year,
                    Country: dictEntry.Country,
                    Population: +dictEntry.Population,
                    MedalCount: counts.total,
                    GoldCount: counts.gold,
                    SilverCount: counts.silver,
                    BronzeCount: counts.bronze,
                    City: counts.city
                });
            }
        });
    });

    return processedData;
}

function getSelectedMedalTypes() {
    const checkboxes = d3.selectAll("#medal-filter input[type='checkbox']");
    const selectedMedalTypes = [];
    checkboxes.each(function() {
        if (d3.select(this).property("checked")) {
            selectedMedalTypes.push(d3.select(this).attr("value"));
        }
    });
    return selectedMedalTypes;
}

function highlightYear(index) {
    d3.selectAll('#timeline span').classed('active', (d, i) => i === index);
}
// Update city info in the HTML
function updateCityInfo(city) {
    console.log(`Updating city info with: ${city}`); // Debugging line
    const cityInfoDiv = d3.select("#city-info");
    cityInfoDiv.html(`Host City: ${city}`);
}
function createTimeline(scenes) {
    const timeline = d3.select('#timeline');
    timeline.selectAll('span')
        .data(scenes)
        .enter()
        .append('span')
        .text(d => d.year)
        .on('click', (event, d, i) => {
            sceneCount = scenes.indexOf(d);
            updateCityInfo(scenes[sceneCount].city); // Add this line to update the city info
            drawScene(scenes[sceneCount]);
            drawCumulativeBarChart(scenes.flatMap(scene => scene.data), scenes[sceneCount].year);
            highlightYear(sceneCount);
            //displayDebugInfo();
        });
    highlightYear(sceneCount);
}

function createScenes(data) {
    // const years = Array.from(new Set(data.map(d => d.Year))).sort();
    // return years.map(year => ({
    //     year: year,
    //     data: data.filter(d => d.Year === year),
    //     city: year
    // }));
    const years = Array.from(new Set(data.map(d => d.Year))).sort();
    return years.map(year => {
        const yearData = data.filter(d => d.Year === year);
        const city = yearData.length > 0 ? yearData[0].City : "Unknown"; // Get the city for the year
        return {
            year: year,
            data: yearData,
            city: city
        };
    });
}

function clearScene() {
    d3.select("#chart").selectAll("*").remove();
}

function clearBarChart() {
    d3.select("#bar-chart").selectAll("*").remove();
}

function drawScene(scene) {
    clearScene();

    // Get the selected medal types
    const selectedMedalTypes = getSelectedMedalTypes();
    const isFilterApplied = selectedMedalTypes.length < 3; // Check if any filter is applied
    // Filter data based on selected medal types and adjust MedalCount
    const filteredData = scene.data.map(d => {
        let filteredMedalCount = 0;
        if (selectedMedalTypes.includes("Gold")) filteredMedalCount += d.GoldCount;
        if (selectedMedalTypes.includes("Silver")) filteredMedalCount += d.SilverCount;
        if (selectedMedalTypes.includes("Bronze")) filteredMedalCount += d.BronzeCount;
        return { ...d, MedalCount: filteredMedalCount };
    }).filter(d => d.MedalCount >= 0);

    const hasData = filteredData.some(d => d.MedalCount > 0);

    // Get all data points for the scene to use for ghost points
    const allData = fullDataset.filter(d => d.Year === scene.year);

    // Define margins and dimensions
    const margin = { top: 50, right: 50, bottom: 100, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create SVG container
    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define scales with the full dataset for consistent axis ranges
    // Logarithmic scales
    // Linear X scale
    // const xScale = d3.scaleLinear()
    //     .domain([0, d3.max(allData, d => d.Population)])
    //     .range([0, width]);
    const xScale = d3.scalePow()
    .exponent(0.5)  // Adjust exponent as needed
    .domain([0, d3.max(filteredData, d => d.Population)])
    .range([0, width]);
    const yScale = d3.scalePow()
        .exponent(0.5)
        .domain([0, d3.max(allData, d => d.MedalCount)]) // Minimum value of 1 to avoid log(0)
        .range([height, 0]);

    const formatAxis = d3.format(".0s");

    // Append X and Y axis
    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(10)) // Apply custom formatting
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)");

    svg.append('g')
        .call(d3.axisLeft(yScale).ticks(10).tickFormat(formatAxis)); // Apply custom formatting

        svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Population');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Medal Count');


    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background", "#fff")
        .style("border", "1px solid #000")
        .style("padding", "5px")
        .style("border-radius", "5px");

    // Plot filtered data
    svg.selectAll('circle.filtered')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('class', 'filtered')
        .attr('cx', d => xScale(d.Population))
        .attr('cy', d => yScale(d.MedalCount))
        .attr('r', 5)
        .attr('fill', 'blue')
        .on("mouseover", function(event, d) {
            tooltip.html(`Country: ${d.Country}<br>Population: ${d.Population}<br>Medal Count: ${d.MedalCount}`)
                .style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });
    

    if(isFilterApplied){
    // Plot ghost points for unfiltered data
        svg.selectAll('circle.ghost')
            .data(allData)
            .enter()
            .append('circle')
            .attr('class', 'ghost')
            .attr('cx', d => xScale(d.Population))
            .attr('cy', d => yScale(d.MedalCount))
            .attr('r', 5)
            .attr('fill', 'green')
            .attr('stroke', 'green')
            .attr('stroke-width', 1)
            .attr('opacity', 0.3); // Set opacity to half

            // Draw lines connecting ghost points to original points
        svg.selectAll('.ghost-line')
            .data(allData)
            .enter()
            .append('line')
            .attr('class', 'ghost-line')
            .attr('x1', d => xScale(d.Population))
            .attr('y1', d => yScale(d.MedalCount))
            .attr('x2', d => {
                const originalPoint = filteredData.find(fp => fp.Country === d.Country);
                return xScale(originalPoint ? originalPoint.Population : d.Population);
            })
            .attr('y2', d => {
                const originalPoint = filteredData.find(fp => fp.Country === d.Country);
                return yScale(originalPoint ? originalPoint.MedalCount : d.MedalCount);
            })
            .attr('stroke', 'grey')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4 1');
    }
    // Add the title and annotation
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '24px')
        .text(`Olympics ${scene.year}`);


    if(hasData){
    // Calculate the top country based on filtered data
    const topCountry = filteredData.reduce((max, d) => d.MedalCount > max.MedalCount ? d : max, { MedalCount: 0 });

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .text(`Top Country: ${topCountry.Country} with ${topCountry.MedalCount} medals`);

    const annotation = [
        {
            note: {
                label: `Top Country: ${topCountry.Country}\nGold: ${topCountry.GoldCount}\nSilver: ${topCountry.SilverCount}\nBronze: ${topCountry.BronzeCount}`,
                title: "Top Country",
                color: "#000000"

            },
            x: xScale(topCountry.Population),
            y: yScale(topCountry.MedalCount),
            dy: 50,
            dx: 50,
            subject: { radius: 15 }
        }
    ];
    const makeAnnotations = d3.annotation()
    .annotations(annotation);
    svg.append("g")
        .call(makeAnnotations);
    
    // Add annotation for the most populated country
    const mostPopulatedCountry = filteredData.reduce((max, d) => d.Population > max.Population ? d : max, { Population: 0 });

    if (mostPopulatedCountry.Population > 0 && mostPopulatedCountry.Country != topCountry.Country) {
        const mostPopulatedAnnotation = [
            {
                note: {
                    label: `Most Populated Country: ${mostPopulatedCountry.Country}\nGold: ${mostPopulatedCountry.GoldCount}\nSilver: ${mostPopulatedCountry.SilverCount}\nBronze: ${mostPopulatedCountry.BronzeCount}`,
                    title: "Most Populated"
                },
                x: xScale(mostPopulatedCountry.Population),
                y: yScale(mostPopulatedCountry.MedalCount),
                dy: 0,
                dx: 10,
                subject: { radius: 15 }
            }
        ];

        const makeMostPopulatedAnnotations = d3.annotation()
            .annotations(mostPopulatedAnnotation);
        svg.append("g")
            .call(makeMostPopulatedAnnotations);
    }
    
    }
    else{
        const annotation = [
            {
                note: {
                    label: "No data remaining after filtering, please select medal type to visualize data.",
                    title: "Data Filtered Out",
                    align: "center"
                },
                x: width / 2,
                y: height / 2,
                dy: 0,
                dx: 0,
                subject: { radius: 0 }
            }
        ];
    const makeAnnotations = d3.annotation()
        .annotations(annotation);

    svg.append("g")
        .call(makeAnnotations);
    }
}
//Function to draw the cumulative bar chart
function drawCumulativeBarChart(data, currentYear) {
    clearBarChart();
    const margin = { top: 50, right: 30, bottom: 50, left: 150 };
    const width = 700 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    const svg = d3.select('#bar-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get the selected medal types
    const selectedMedalTypes = getSelectedMedalTypes();

    // // Filter data based on selected medal types and adjust MedalCount
    // const filteredData = data.filter(d => d.Year <= currentYear).map(d => {
    //     let filteredMedalCount = 0;
    //     if (selectedMedalTypes.includes("Gold")) filteredMedalCount += d.GoldCount;
    //     if (selectedMedalTypes.includes("Silver")) filteredMedalCount += d.SilverCount;
    //     if (selectedMedalTypes.includes("Bronze")) filteredMedalCount += d.BronzeCount;
    //     return { ...d, MedalCount: filteredMedalCount };
    // }).filter(d => d.MedalCount > 0);

    // const countryMedalCounts = d3.rollup(filteredData, v => d3.sum(v, d => d.MedalCount), d => d.Country);

    // const medalData = Array.from(countryMedalCounts, ([Country, MedalCount]) => ({ Country, MedalCount }))
    //     .sort((a, b) => b.MedalCount - a.MedalCount)
    //     .slice(0, 10);
   // Filter data based on selected medal types and adjust MedalCount
    const filteredData = data.filter(d => d.Year <= currentYear).map(d => {
        let filteredMedalCount = 0;
        if (selectedMedalTypes.includes("Gold")) filteredMedalCount += d.GoldCount;
        if (selectedMedalTypes.includes("Silver")) filteredMedalCount += d.SilverCount;
        if (selectedMedalTypes.includes("Bronze")) filteredMedalCount += d.BronzeCount;
        return { 
            ...d, 
            MedalCount: filteredMedalCount,
            Gold: d.GoldCount || 0,
            Silver: d.SilverCount || 0,
            Bronze: d.BronzeCount || 0
        };
    }).filter(d => d.MedalCount > 0);

    const countryMedalCounts = d3.rollup(filteredData, v => ({
        total: d3.sum(v, d => d.MedalCount),
        gold: d3.sum(v, d => d.Gold),
        silver: d3.sum(v, d => d.Silver),
        bronze: d3.sum(v, d => d.Bronze)
    }), d => d.Country);

    const medalData = Array.from(countryMedalCounts, ([Country, counts]) => ({
        Country, 
        MedalCount: counts.total,
        Gold: counts.gold,
        Silver: counts.silver,
        Bronze: counts.bronze
    }))
    .sort((a, b) => b.MedalCount - a.MedalCount)
    .slice(0, 10);


    const yScale = d3.scaleBand()
        .domain(medalData.map(d => d.Country))
        .range([0, height])
        .padding(0.1);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(medalData, d => d.MedalCount)])
        .range([0, width]);

    svg.append('g')
        .call(d3.axisLeft(yScale));

    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(5));
    // svg.selectAll('.bar')
    //     .data(medalData)
    //     .enter()
    //     .append('rect')
    //     .attr('class', 'bar')
    //     .attr('y', d => yScale(d.Country))
    //     .attr('height', yScale.bandwidth())
    //     .attr('x', 0)
    //     .attr('width', d => xScale(d.MedalCount))
    //     .attr('fill', 'steelblue');

    // Create the tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden")
        .style("background", "#fff")
        .style("border", "1px solid #000")
        .style("padding", "5px")
        .style("border-radius", "5px");

    svg.selectAll('.bar')
        .data(medalData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', d => yScale(d.Country))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', d => xScale(d.MedalCount))
        .attr('fill', 'steelblue')
        .on("mouseover", function(event, d) {
            tooltip.html(`
                <strong>${d.Country}</strong><br/>
                Gold: ${d.Gold}<br/>
                Silver: ${d.Silver}<br/>
                Bronze: ${d.Bronze}<br/>
                Total: ${d.MedalCount}
            `)
            .style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .style('font-size', '24px')
        .text(`Top 10 Countries by Cumulative Medal Count`);
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Medal Count');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Country');

    svg.selectAll('.label')
        .data(medalData)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('x', d => xScale(d.MedalCount) + 5)
        .attr('y', d => yScale(d.Country) + yScale.bandwidth() / 2)
        .attr('dy', '.35em')
        .text(d => d.MedalCount);

    // Identify the #1 country in 1904
    if (currentYear == 1904) {
        const topCountry1904 = medalData[0];
        console.log("Year is 1904, adding annotation.");

        // Add annotation
        if (topCountry1904) {
            console.log("Top country in 1904:", topCountry1904);

            const annotation2 = [
                {
                    note: {
                        label: `${topCountry1904.Country} took the lead in 1904`,
                        title: "FIRST USA LEAD",
                        align: "middle"
                    },
                    x: xScale(topCountry1904.MedalCount),
                    y: yScale(topCountry1904.Country) + yScale.bandwidth() / 2,
                    dy: 50,
                    dx: 0,
                    color: "#c89000"
                }
            ];

            const makeAnnotations = d3.annotation()
                .annotations(annotation2)
                .type(d3.annotationLabel);

            svg.append("g")
                .call(makeAnnotations);
        }
    }

    // Identify the #1 country in 2022
    if (currentYear == 2022) {
        const topCountry2022 = medalData[0];

        if (topCountry2022) {
            const annotation2022 = [
                {
                    note: {
                        label: `${topCountry2022.Country} currently leads in 2022! We'll see how this list changes after the 2024 Paris Olympics!`,
                        title: "Top Country in 2022",
                        align: "middle"
                    },
                    x: xScale(topCountry2022.MedalCount),
                    y: yScale(topCountry2022.Country) + yScale.bandwidth() / 2,
                    dy: 50,
                    dx: 0,
                    color: "#c89000"
                }
            ];

            const makeAnnotations2022 = d3.annotation()
                .annotations(annotation2022)
                .type(d3.annotationLabel);

            svg.append("g")
                .call(makeAnnotations2022);
        }
    }
}
function updateFilterCharts() {
    if (scenes.length > 0) {
        drawScene(scenes[sceneCount]);
        drawCumulativeBarChart(scenes.flatMap(scene => scene.data), scenes[sceneCount].year);
    }
}



document.addEventListener('DOMContentLoaded', function() {
    initialize();

    document.getElementById("back").addEventListener('click', () => {
        console.log('Back button clicked'); // Debugging
        previousScene();
        //displayDebugInfo();
    });

    document.getElementById("forward").addEventListener('click', () => {
        console.log('Forward button clicked'); // Debugging
        nextScene();
        //displayDebugInfo();
    });
    // Add event listeners for the filter checkboxes
    d3.selectAll("#medal-filter input").on("change", function() {
        updateFilterCharts();
    });
});

function nextScene() {
    if (sceneCount < scenes.length - 1) {
        sceneCount++;
        drawScene(scenes[sceneCount]);
        drawCumulativeBarChart(scenes.flatMap(scene => scene.data), scenes[sceneCount].year); // Update cumulative bar chart
        highlightYear(sceneCount);
        updateCityInfo(scenes[sceneCount].city); 
    }
}

function previousScene() {
    if (sceneCount > 0) {
        sceneCount--;
        drawScene(scenes[sceneCount]);
        drawCumulativeBarChart(scenes.flatMap(scene => scene.data), scenes[sceneCount].year); // Update cumulative bar chart
        highlightYear(sceneCount);
        updateCityInfo(scenes[sceneCount].city); 
    }
}