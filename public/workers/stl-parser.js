// Background STL Parser Web Worker
self.onmessage = function (e) {
  const { arrayBuffer } = e.data;
  
  try {
    const dv = new DataView(arrayBuffer);
    
    // Check if it is binary STL
    // Binary STL has 80 byte header, followed by 4 byte triangle count (uint32)
    // and then (count * 50) bytes of triangle data.
    const totalBytes = arrayBuffer.byteLength;
    if (totalBytes < 84) {
      throw new Error("File too small to be a valid STL file.");
    }
    
    const numTriangles = dv.getUint32(80, true);
    const expectedBytes = 84 + numTriangles * 50;
    
    // Fallback or validation
    if (expectedBytes > totalBytes) {
      throw new Error("File size does not match binary STL structure.");
    }
    
    // Parse vertices
    const positions = new Float32Array(numTriangles * 9);
    const normals = new Float32Array(numTriangles * 9);
    
    let offset = 84;
    let posIdx = 0;
    let normIdx = 0;
    
    for (let i = 0; i < numTriangles; i++) {
      // Normal vector (3 floats)
      const nx = dv.getFloat32(offset, true);
      const ny = dv.getFloat32(offset + 4, true);
      const nz = dv.getFloat32(offset + 8, true);
      offset += 12;
      
      // Vertices (3 vertices, each 3 floats)
      for (let v = 0; v < 3; v++) {
        const vx = dv.getFloat32(offset, true);
        const vy = dv.getFloat32(offset + 4, true);
        const vz = dv.getFloat32(offset + 8, true);
        offset += 12;
        
        positions[posIdx++] = vx;
        positions[posIdx++] = vy;
        positions[posIdx++] = vz;
        
        normals[normIdx++] = nx;
        normals[normIdx++] = ny;
        normals[normIdx++] = nz;
      }
      
      // Attribute byte count (2 bytes)
      offset += 2;
    }
    
    // Calculate bounding box for center calculations
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i+1];
      const z = positions[i+2];
      
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    
    const boundingBox = { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
    
    self.postMessage({
      ok: true,
      positions: positions.buffer,
      normals: normals.buffer,
      boundingBox,
      numTriangles
    }, [positions.buffer, normals.buffer]);
    
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
