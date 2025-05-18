let map = L.map('map').setView([30.3165, 78.0322], 12); //cordinates of dehradun
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 17
}).addTo(map);

let selected = [];

function animatePath(latlngs) {
  let marker = L.marker(latlngs[0]).addTo(map);
  let i = 0;
  function move() {
    if (i < latlngs.length - 1) {
      i++;
      marker.setLatLng(latlngs[i]);
      setTimeout(move, 50);
    }
  }
  move();
}


function animateExploration(visitedOrder, callback) {
  let i = 0;

  function explore() {
    if (i >= visitedOrder.length) {
      callback();
      return;
    }

    const [lng, lat] = visitedOrder[i].split(',').map(Number);
    const circle = L.circle([lat, lng], {
      radius: 5,
      color: 'blue',
      fillColor: '#30f',
      fillOpacity: 0.5
    }).addTo(map);

    i++;
    setTimeout(explore, 0); // delay between node visits
  }

  explore();
}


function drawPath(path) {
  if (!path.length) return;
  const latlngs = path.map(p => {
    const [lng, lat] = p.split(',').map(Number);
    return [lat, lng];
  });

  L.polyline(latlngs, { color: 'black' }).addTo(map);
  animatePath(latlngs);
}

map.on('click', function (e) {
  selected.push([e.latlng.lng, e.latlng.lat]);
  L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

  if (selected.length === 2) {
    fetch('/shortest-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startCoord: selected[0], endCoord: selected[1] })
    })
    .then(res => res.json())
.then(data => {
  animateExploration(data.visitedOrder, () => {
    drawPath(data.path);
  });
});


    selected = [];
  }
});
