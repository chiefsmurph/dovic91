import './App.css';

import { useState, useEffect} from 'react';

import { Line } from 'react-chartjs-2';

import ReactGA from 'react-ga';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const colors = ['green', 'orange', 'blue', 'red', 'turquoise', 'magenta'];
const chartOptions = { 
    responsive: true, 
    maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { family: 'Montserrat' }}}}
};
function GraphSection({ title, socket, sources = [], socketMethod, jsonUrl, options = () => {} }) {
    const [optionsData, setOptionsData] = useState({});
    const [socketData, setSocketData] = useState(null);
    const key = optionsData.excludeAfrica ? 'excludingAfrica' : 'overall';
    const { lastChange } = socketData || {};
    let { highestLowest, totalLocations } = (socketData || {})[key] || {};

    if (highestLowest) {
        // fixes glitching in states
        highestLowest = highestLowest.filter(obj => Object.values(obj).every(Boolean));
        // cuts off beginning without v data in world
        highestLowest = highestLowest.filter(data => {
            const { highestVaccinated_locations = '', lowestVaccinated_locations = '' } = data;
            const allHighest = highestVaccinated_locations.split(',');
            const allBad = allHighest.filter(l => 
                lowestVaccinated_locations.split(',').includes(l)
            );
            return allBad.length / allHighest.length < 0.2;
        });
    }

    useEffect(() => {
        socket.on(socketMethod, data => {
            console.log({ data });
            setSocketData(data);
        });
    }, [socket, socketMethod]);
    const getChartData = keyFilter => ({
        labels: highestLowest.map(({ date }) => date),
        datasets: Object.keys(highestLowest[0])
            .filter(key => key.includes(keyFilter))
            .filter(key => key !== 'date')
            .map((key, i) => ({
                label: key,
                // fill: false,
                // lineTension: 0.1,
                backgroundColor: colors[i],
                borderColor: colors[i],
                // borderCapStyle: 'butt',
                // borderDash: [],
                // borderDashOffset: 0.0,
                // borderJoinStyle: 'miter',
                // pointBorderColor: colors[i],
                // pointBackgroundColor: '#fff',
                // pointBorderWidth: 1,
                // pointHoverRadius: 5,
                // // pointHoverBackgroundColor: colors[i],
                // // pointHoverBorderColor: colors[i],
                // pointHoverBorderWidth: 2,
                pointRadius: 0.5,
                // pointHitRadius: 10,
                data: highestLowest.map(d => d[key] || undefined)
            }))
    });
    if (!highestLowest) return null;
    const {
        highestVaccinated_locations,
        highestVaccinated_total_vaccinations_per_hundred,
        highestVaccinated_total_deaths_per_million,
        highestVaccinated_total_cases_per_million,

        lowestVaccinated_locations,
        lowestVaccinated_total_vaccinations_per_hundred,
        lowestVaccinated_total_deaths_per_million,
        lowestVaccinated_total_cases_per_million,
        // date: mostRecentDate
    } = highestLowest[highestLowest.length - 1];
    const numHighest = highestVaccinated_locations.split(',').length;
    const numLowest = lowestVaccinated_locations.split(',').length;
    const friendlyJson = jsonUrl.split('/').pop();
    return (
        <div className="graph-section">
            <h2>
                {[totalLocations, title].join(' ')}<br/>
                <i>last changed: {(new Date(lastChange)).toLocaleString()}</i><br/>
                <span>
                    source{sources.length > 1 ? 's' : ''}:&nbsp;
                    {sources.map(({ url, name }) => <a href={url} target="_blank" rel="noreferrer">{name}</a>)}
                </span>
                <pre>
                    <a 
                        href={jsonUrl} 
                        onClick={() => 
                            ReactGA.event({ category: 'User', action: `Downloaded ${friendlyJson}`}
                        )}
                        target="_blank"
                        rel="noreferrer"
                    >
                        ⬇ {friendlyJson}
                    </a>
                </pre>
            </h2>
            {options(optionsData, setOptionsData)}
            {
                highestLowest && (
                <>
                    <table width="100%" cellSpacing={0}>
                        <thead>
                            <th>{numHighest} Highest Vaccinated</th>
                            <th>{numLowest} Lowest Vaccinated</th>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    {highestVaccinated_locations.split(',').slice(0, 7).join(', ')}
                                    {numHighest > 7 ? '...' : ''}
                                    <hr/>
                                    Total Vaccinations / Hundred: {highestVaccinated_total_vaccinations_per_hundred}<br/>
                                    Total Cases / Million: {highestVaccinated_total_cases_per_million}<br/>
                                    Total Deaths / Million: {highestVaccinated_total_deaths_per_million}<br/>
                                </td>
                                <td>
                                    {lowestVaccinated_locations.split(',').slice(0, 7).join(', ')}
                                    {numLowest > 7 ? '...' : ''}
                                    <hr/>
                                    Total Vaccinations / Hundred: {lowestVaccinated_total_vaccinations_per_hundred}<br/>
                                    Total Cases / Million: {lowestVaccinated_total_cases_per_million}<br/>
                                    Total Deaths / Million: {lowestVaccinated_total_deaths_per_million}<br/>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="charts">
                        <div><Line data={getChartData('cases')} options={chartOptions} /></div>
                        <div><Line data={getChartData('deaths')} options={chartOptions}  /></div>
                        <div><Line data={getChartData('total_vacc')} options={chartOptions}  /></div>
                    </div>
                </>
                )
            }
            {/* <pre>{JSON.stringify(highestLowest, null, 2)}</pre> */}
        </div>
    );
}

export default GraphSection;