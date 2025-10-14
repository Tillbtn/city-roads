import request from './request.js';
import Progress from './Progress.js';

let backends = [
  //'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/cgi/interpreter'
];

export default function postData(data, progress) {
  progress = progress || new Progress();
  const postData = {
    method: 'POST',
    responseType: 'json',
    progress,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: 'data=' + encodeURIComponent(data),
  };

  let serverIndex = 0;

  // --- LOGGING: Start der Anfrage ---
  console.groupCollapsed(`[postData] Starting new Overpass request at ${new Date().toLocaleTimeString()}`);
  console.log('Overpass QL query being sent:', data);
  console.groupEnd();

  return fetchFrom(backends[serverIndex]);

  function fetchFrom(overpassUrl) {
    // --- LOGGING: Welcher Server wird versucht? ---
    console.info(`[postData] Attempting to fetch from server #${serverIndex + 1}: ${overpassUrl}`);

    return request(overpassUrl, postData, 'POST')
      .then(response => {
        // --- LOGGING: Erfolgreiche Antwort ---
        console.group('[postData] SUCCESS!');
        console.log('Successfully received response from:', overpassUrl);
        // Überprüfen, ob die Antwort Elemente enthält oder leer ist
        if (response && response.elements && response.elements.length > 0) {
          console.log(`Response contains ${response.elements.length} elements.`);
        } else {
          console.warn('Response object received, but it contains NO elements. This might indicate a valid but empty result for the query/bbox.');
        }
        console.log('Full response object:', response);
        console.groupEnd();
        return response; // Wichtig: Die Antwort weitergeben
      })
      .catch(handleError);
  }

  function handleError(err) {
    // --- LOGGING: Fehler bei der Anfrage ---
    console.warn(`[postData] FAILED request to ${backends[serverIndex]}`);
    console.error('Error details:', err);

    if (err.cancelled) {
      console.log('[postData] Request was cancelled by user.');
      throw err;
    }

    if (serverIndex >= backends.length - 1) {
      // --- LOGGING: Endgültiges Scheitern ---
      console.error('[postData] FATAL: All backend servers failed. Giving up.');
      throw err;
    }

    if (err.statusError) {
      progress.notify({
        loaded: -1
      });
    }

    // --- LOGGING: Wechsel zum nächsten Server ---
    serverIndex += 1;
    console.log(`[postData] Switching to the next server...`);
    return fetchFrom(backends[serverIndex])
  }
}
