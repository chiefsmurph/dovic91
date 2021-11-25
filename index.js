const USE_CURRENT_HIGHEST_AND_LOWEST = true;
const USE_JSON = true;
const NUM_PER_SUBSET = 5;


const request = require('axios');
const { omit, mapObject, uniq } = require('underscore');
const avg = array => {
    const arr = array.filter(Boolean);
    return arr.reduce((acc, val) => acc + val, 0) / arr.length;
};


const requiredFields = [
    'total_cases_per_million', 'total_deaths_per_million', 'total_vaccinations_per_hundred'
];
const hasRequiredFields = d => requiredFields.every(key => d[key] !== undefined);


const getHighestLowest = ({ 
    withVaccinationTotals,
    date,
    highestVaccinatedLocations = [],
    lowestVaccinatedLocations = [],
}) => {

    const slicedVaccinationTotals = getAggregatesForDate({
        withVaccinationTotals,
        date,
    });
    
    // console.log({ withVaccinationTotals, slicedVaccinationTotals })
    const highestVaccinated = highestVaccinatedLocations.length
        ? highestVaccinatedLocations.map(location => slicedVaccinationTotals.find(p => p.location === location)).filter(Boolean)
        : [...slicedVaccinationTotals].sort((a, b) => b.total_vaccinations_per_hundred - a.total_vaccinations_per_hundred).slice(0, NUM_PER_SUBSET);
    const lowestVaccinated = lowestVaccinatedLocations.length
        ? lowestVaccinatedLocations.map(location => slicedVaccinationTotals.find(p => p.location === location)).filter(Boolean)
        : [...slicedVaccinationTotals].sort((a, b) => a.total_vaccinations_per_hundred - b.total_vaccinations_per_hundred).slice(0, NUM_PER_SUBSET);

    console.log({
        date,
        highestVaccinated: highestVaccinated.map(t => t.location),
        lowestVaccinated: lowestVaccinated.map(t => t.location),
    });
    return mapObject({
        highestVaccinated,
        lowestVaccinated,
    }, subset => 
        [
            'total_vaccinations_per_hundred',
            'total_cases_per_million',
            'total_deaths_per_million'
        ].reduce((acc, key) => ({
            ...acc,
            [key]: +avg(subset.map(d => d[key])).toFixed(1)
        }), {
            locations: subset.map(t => t.location)
        })
    );
};

const getAggregatesForDate = ({
    withVaccinationTotals,
    date,
}) => {
    
    let slicedVaccinationTotals = withVaccinationTotals
        .map(({ data, ...p }) => ({
            ...p,
            ...[...data].reverse().find(d => (new Date(d.date)).getTime() <= (new Date(date)).getTime())
        }))
        .filter(hasRequiredFields)
        .sort((a, b) => b.total_vaccinations_per_hundred - a.total_vaccinations_per_hundred);

    return slicedVaccinationTotals;

};



(async () => {
    console.log('request data...', typeof require('./owid-covid-data.json'), Object.keys(require('./owid-covid-data.json')));

    const covidData = USE_JSON
            ? require('./owid-covid-data.json')
            : (await request('https://covid.ourworldindata.org/data/owid-covid-data.json')).data;
    // const { data: vaccinationsData } = await request('https://covid.ourworldindata.org/data/vaccinations/vaccinations.json');

    console.log({ USE_CURRENT_HIGHEST_AND_LOWEST})
    const withVaccinationTotals = Object.keys(covidData)
        .map(iso_code => {
            const { location, data, ...rest } = covidData[iso_code];
            // console.log({ location, data, iso_code });
            // const withTotals = data.filter(({ total_vaccinations_per_hundred }) => total_vaccinations_per_hundred);
            // const mostRecentTotal = withTotals.pop();
            const importantData = data.filter(hasRequiredFields);
            return {
                iso_code,
                location,
                locationData: rest,
                data: importantData,
            };
        })
        // .filter(location => {
        //     return true//location.locationData.population < 1000000;
        //     return location.locationData.continent === 'North America';
        //     console.log({ location})
        //     return true;
        // });

    console.log("TOTAL LOCATIONS", withVaccinationTotals.length);


    const allDates = uniq(withVaccinationTotals.map(t => t.data.map(t => t.date)).flat(2))
        .sort((a, b) => (new Date(a)).getTime() - (new Date(b)).getTime());
    console.log({ allDates })
    // TEMP
    const mostRecentDate = allDates[allDates.length - 1];
    console.log(`NOW LETS GET THE CURRENT HIGHEST AND LOWEST LOCATIONS FOR ${mostRecentDate}`);
    const mostRecentAggs = getAggregatesForDate({
        withVaccinationTotals, 
        date: mostRecentDate
    });

    console.log({ mostRecentAggs })


    let currentHighestLowest = USE_CURRENT_HIGHEST_AND_LOWEST && (() => {
        const mostRecentDate = allDates[allDates.length - 1];
        console.log(`NOW LETS GET THE CURRENT HIGHEST AND LOWEST LOCATIONS FOR ${mostRecentDate}`);
        const mostRecentAggs = getHighestLowest({
            withVaccinationTotals, 
            date: mostRecentDate
        });
        console.log(JSON.stringify(mostRecentAggs, null, 2))
        const {
            highestVaccinated: {
                locations: highestVaccinatedLocations
            },
            lowestVaccinated: {
                locations: lowestVaccinatedLocations
            }
        } = mostRecentAggs;
        // console.log({ mostRecentAggs })
        const highestLowest = {
            highestVaccinatedLocations,
            lowestVaccinatedLocations
        };
        console.log('GOT THE CURRENT HIGHEST VACCINATED AND LOWEST VACCINATED LOCATIONS');
        console.log(highestLowest)
        return highestLowest;
    })();


    const withAggregates = allDates.map(date => ({
        date,
        aggregates: getHighestLowest({
            withVaccinationTotals,
            date,
            ...currentHighestLowest
        })
    }));



    const prefixKeys = (object, prefix) => 
        Object.keys(object).reduce((acc, key) => ({
            ...acc,
            [`${prefix}${key}`]: object[key]
        }), {});

    const formatted = withAggregates
        .map(({ 
            date, 
            aggregates: { 
                highestVaccinated,
                lowestVaccinated,
            }
        }) => ({
            date,
            ...prefixKeys(highestVaccinated, 'highestVaccinated_'),
            ...prefixKeys(lowestVaccinated, 'lowestVaccinated_'),
        }))
        .map(({ highestVaccinated_locations, lowestVaccinated_locations, ...rest }) => ({
            ...rest,
            highestVaccinated_locations: highestVaccinated_locations.join(', '),
            lowestVaccinated_locations: lowestVaccinated_locations.join(', '),
        }));


    console.log(JSON.stringify({ formatted }, null, 2));
    
})();