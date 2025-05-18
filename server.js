// server.js
const express = require('express');
const fs = require('fs');
const KDBush = require('kdbush');
const TinyQueue = require('tinyqueue');
const app = express();
const PORT = 3000;

const graph = JSON.parse(fs.readFileSync('./public/graph.json', 'utf8'));
app.use(express.static('public'));
app.use(express.json());

// Step 1: Prepare spatial index
const nodes = Object.keys(graph).map(key => {
  const [lng, lat] = key.split(',').map(Number);
  return { id: key, lng, lat };
});

const index = new KDBush(
  nodes,
  p => p.lng,
  p => p.lat
);

// Haversine function for backup accuracy
function haversineDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371e3;

  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Step 2: Use spatial index to find nearest node
function getNearestNode(coord) {
  const [lng, lat] = coord;
  const candidates = index.within(lng, lat, 0.1); // radius in degrees (~10km)

  let nearest = null;
  let minDist = Infinity;

  for (const i of candidates) {
    const candidate = nodes[i];
    const dist = haversineDistance(coord, [candidate.lng, candidate.lat]);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate.id;
    }
  }

  return nearest;
}

// Dijkstra's algorithm using TinyQueue
function dijkstra(start, end) {
  const distances = {};
  const prev = {};
  const visitedOrder = [];
  const visited = new Set();

  const queue = new TinyQueue([], (a, b) => a.priority - b.priority);
  queue.push({ node: start, priority: 0 });

  for (const node in graph) distances[node] = Infinity;
  distances[start] = 0;

  while (queue.length > 0) {
    const { node: current } = queue.pop();

    if (visited.has(current)) continue;
    visited.add(current);
    visitedOrder.push(current);

    if (current === end) break;

    for (const neighbor in graph[current]) {
      const alt = distances[current] + graph[current][neighbor];
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        prev[neighbor] = current;
        queue.push({ node: neighbor, priority: alt });
      }
    }
  }

  const path = [];
  let current = end;
  while (current) {
    path.unshift(current);
    current = prev[current];
  }

  return {
    path: distances[end] === Infinity ? [] : path,
    visitedOrder
  };
}

// API endpoint
app.post('/shortest-path', (req, res) => {
  const { startCoord, endCoord } = req.body;
  const startNode = getNearestNode(startCoord);
  const endNode = getNearestNode(endCoord);

  if (!startNode || !endNode) {
    return res.status(400).json({ error: 'Could not find nearest nodes.' });
  }

  const { path, visitedOrder } = dijkstra(startNode, endNode);
  res.json({ path, visitedOrder });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
