'use strict';

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

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

  surface.Draw();
}

function CreateSurfaceData() {
  let verticesArray = [],
      normalsArray = [];
  const paramA = 1.5;
  const paramB = 3;
  const paramC = 2;
  const paramD = 1;

  const calculateF = (paramA, paramB, angleV) => {
    return (
        (paramA * paramB) /
        Math.sqrt(
            Math.pow(paramA, 2) +
            Math.pow(Math.sin(angleV), 2) +
            Math.pow(paramB, 2) * Math.pow(Math.cos(angleV), 2)
        )
    );
  };

  const computeVertex = (angleU, angleV) => {
    const radU = deg2rad(angleU);
    const radV = deg2rad(angleV);
    const xCoord =
        (1 / 2) *
        (calculateF(paramA, paramB, radV) * (1 + Math.cos(radU)) +
            ((Math.pow(paramD, 2) - Math.pow(paramC, 2)) * (1 - Math.cos(radU))) /
            calculateF(paramA, paramB, radV)) *
        Math.cos(radV);
    const yCoord =
        (1 / 2) *
        (calculateF(paramA, paramB, radV) * (1 + Math.cos(radU)) +
            ((Math.pow(paramD, 2) - Math.pow(paramC, 2)) * (1 - Math.cos(radU))) /
            calculateF(paramA, paramB, radV)) *
        Math.sin(radV);
    const zCoord =
        (1 / 2) *
        (calculateF(paramA, paramB, radV) -
            (Math.pow(paramD, 2) - Math.pow(paramC, 2)) / calculateF(paramA, paramB, radV)) *
        Math.sin(radU);
    return [xCoord, yCoord, zCoord];
  };

  const computeNormal = (angleU, angleV) => {
    let smallDelta = 0.0001;
    let mainVertex = computeVertex(angleU, angleV);
    let uVertex = computeVertex(angleU + smallDelta, angleV);
    let vVertex = computeVertex(angleU, angleV + smallDelta);
    let gradientU = [];
    let gradientV = [];
    for (let i = 0; i < 3; i++) {
      gradientU.push((mainVertex[i] - uVertex[i]) / smallDelta);
      gradientV.push((mainVertex[i] - vVertex[i]) / smallDelta);
    }
    const normalVector = m4.normalize(m4.cross(gradientU, gradientV));
    return normalVector;
  };

  for (let angleU = 0; angleU <= 360; angleU += 5) {
    for (let angleV = 0; angleV <= 360; angleV += 5) {
      let vert1 = computeVertex(angleU, angleV);
      let vert2 = computeVertex(angleU + 5, angleV);
      let vert3 = computeVertex(angleU, angleV + 5);
      let vert4 = computeVertex(angleU + 5, angleV + 5);
      let norm1 = computeNormal(angleU, angleV);
      let norm2 = computeNormal(angleU + 5, angleV);
      let norm3 = computeNormal(angleU, angleV + 5);
      let norm4 = computeNormal(angleU + 5, angleV + 5);
      verticesArray.push(...vert1, ...vert2, ...vert3, ...vert3, ...vert2, ...vert4);
      normalsArray.push(...norm1, ...norm2, ...norm3, ...norm3, ...norm2, ...norm4);
    }
  }

  return [verticesArray, normalsArray];
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

  surface = new Model('Surface');
  surface.BufferData(...CreateSurfaceData());

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
}
