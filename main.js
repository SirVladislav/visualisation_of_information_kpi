'use strict';

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.
let sphere;

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iNormalBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, normals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

    // gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
  };
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 4, 1, 6, 14);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    modelViewProjection
  );

  const normal = m4.identity();
  m4.inverse(modelView, normal);
  m4.transpose(normal, normal);

  gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normal);


  /* Draw the six faces of a cube, with different colors. */
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
  gl.uniform3fv(shProgram.iLightPos, [3 * Math.cos(Date.now() * 0.001), 3 * Math.sin(Date.now() * 0.001), 1]);

  surface.Draw();
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 255]);
  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    m4.multiply(modelViewProjection,
      m4.translation(3 * Math.cos(Date.now() * 0.001), 3 * Math.sin(Date.now() * 0.001), 1))
  );
  sphere.Draw();
}

function animate() {
  draw()
  window.requestAnimationFrame(animate)
}

function CreateSurfaceData() {
  let vertices = [],
      normals = [];
  const alpha = 1.5;
  const beta = 3;
  const gamma = 2;
  const delta = 1;

  // Функция для расчета координаты F
  const calculateF = (alpha, beta, theta) => {
    return (
        (alpha * beta) /
        Math.sqrt(
            Math.pow(alpha, 2) +
            Math.pow(Math.sin(theta), 2) +
            Math.pow(beta, 2) * Math.pow(Math.cos(theta), 2)
        )
    );
  };

  // Функция для получения вершины на поверхности
  const getPoint = (phi, theta) => {
    const phiRad = deg2rad(phi);
    const thetaRad = deg2rad(theta);
    const x =
        (1 / 2) *
        (calculateF(alpha, beta, thetaRad) * (1 + Math.cos(phiRad)) +
            ((Math.pow(delta, 2) - Math.pow(gamma, 2)) * (1 - Math.cos(phiRad))) /
            calculateF(alpha, beta, thetaRad)) *
        Math.cos(thetaRad);
    const y =
        (1 / 2) *
        (calculateF(alpha, beta, thetaRad) * (1 + Math.cos(phiRad)) +
            ((Math.pow(delta, 2) - Math.pow(gamma, 2)) * (1 - Math.cos(phiRad))) /
            calculateF(alpha, beta, thetaRad)) *
        Math.sin(thetaRad);
    const z =
        (1 / 2) *
        (calculateF(alpha, beta, thetaRad) -
            (Math.pow(delta, 2) - Math.pow(gamma, 2)) / calculateF(alpha, beta, thetaRad)) *
        Math.sin(phiRad);
    return [x, y, z]
  }

  // Функция для расчета нормали
  const calculateNormal = (phi, theta) => {
    let epsilon = 0.0001
    let point = getPoint(phi, theta)
    let pointPhi = getPoint(phi + epsilon, theta)
    let pointTheta = getPoint(phi, theta + epsilon)
    let dPhi = []
    let dTheta = []
    for (let i = 0; i < 3; i++) {
      dPhi.push((point[i] - pointPhi[i]) / epsilon)
      dTheta.push((point[i] - pointTheta[i]) / epsilon)
    }
    const normal = m4.normalize(m4.cross(dPhi, dTheta))
    return normal
  }

  // Заполнение списков вершин и нормалей
  for (let phi = 0; phi <= 360; phi += 5) {
    for (let theta = 0; theta <= 360; theta += 5) {
      let point1 = getPoint(phi, theta)
      let point2 = getPoint(phi + 5, theta)
      let point3 = getPoint(phi, theta + 5)
      let point4 = getPoint(phi + 5, theta + 5)
      let normal1 = calculateNormal(phi, theta)
      let normal2 = calculateNormal(phi + 5, theta)
      let normal3 = calculateNormal(phi, theta + 5)
      let normal4 = calculateNormal(phi + 5, theta + 5)
      vertices.push(...point1, ...point2, ...point3, ...point3, ...point2, ...point4);
      normals.push(...normal1, ...normal2, ...normal3, ...normal3, ...normal2, ...normal4);
    }
  }

  return [vertices, normals];
}

function CreateSphereSurfaceData() {
  let vertexList = [];

  let u = 0,
    t = 0;
  while (u < Math.PI * 2) {
    while (t < Math.PI) {
      let v = sphereSurface(u, t);
      let w = sphereSurface(u + 0.1, t);
      let wv = sphereSurface(u, t + 0.1);
      let ww = sphereSurface(u + 0.1, t + 0.1);
      vertexList.push(v.x, v.y, v.z);
      vertexList.push(w.x, w.y, w.z);
      vertexList.push(wv.x, wv.y, wv.z);
      vertexList.push(wv.x, wv.y, wv.z);
      vertexList.push(w.x, w.y, w.z);
      vertexList.push(ww.x, ww.y, ww.z);
      t += 0.1;
    }
    t = 0;
    u += 0.1;
  }
  return vertexList
}
const radius = 0.2;
function sphereSurface(long, lat) {
  return {
    x: radius * Math.cos(long) * Math.sin(lat),
    y: radius * Math.sin(long) * Math.sin(lat),
    z: radius * Math.cos(lat)
  }
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
  shProgram.iAttribNormal = gl.getAttribLocation(prog, 'normal');
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    'ModelViewProjectionMatrix'
  );
  shProgram.iNormalMatrix = gl.getUniformLocation(
    prog,
    'NormalM'
  );
  shProgram.iColor = gl.getUniformLocation(prog, 'color');
  shProgram.iLightPos = gl.getUniformLocation(prog, 'lightPos');

  surface = new Model('Surface');
  surface.BufferData(...CreateSurfaceData());
  sphere = new Model()
  sphere.BufferData(CreateSphereSurfaceData(), CreateSphereSurfaceData())

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error('Error in vertex shader:  ' + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error('Error in fragment shader:  ' + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Link error in program:  ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById('webglcanvas');
    gl = canvas.getContext('webgl');
    if (!gl) {
      throw 'Browser does not support WebGL';
    }
  } catch (e) {
    document.getElementById('canvas-holder').innerHTML =
      '<p>Sorry, could not get a WebGL graphics context.</p>';
    return;
  }
  try {
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById('canvas-holder').innerHTML =
      '<p>Sorry, could not initialize the WebGL graphics context: ' +
      e +
      '</p>';
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  draw();
  animate()
}
