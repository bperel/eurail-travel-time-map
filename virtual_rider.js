import {single_source_shortest_paths, find_path} from 'dijkstrajs'

export const MAX_TIME = 1000 * 60;

export const getTravelTimes = (homeStationId, graph, stationsAndPorts) => {
  const travelTimes = {};
  for (const station of Object.keys(stationsAndPorts).filter(station => station !== homeStationId)) {
    travelTimes[station] = MAX_TIME;
  }
  const reachableStations = Object.keys(single_source_shortest_paths(graph, homeStationId));
  for (const reachableStation of reachableStations) {
    const pathSteps = find_path(graph, homeStationId, reachableStation);
    travelTimes[reachableStation] = pathSteps.reduce((acc, station, idx) => acc + (idx === 0 ? 0 : graph[pathSteps[idx - 1]][station]), 0)
  }

  travelTimes[homeStationId] = 0
  return travelTimes;
};
