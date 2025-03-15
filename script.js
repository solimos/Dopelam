const regl = createREGL({
  container: document.querySelector("#display"),
  pixelRatio: Math.min(2, window.devicePixelRatio)
});
const { mat4 } = glMatrix;

const c = document.querySelector("#display");

function makeCtx(
  w,
  h,
  pixelRatio = 1
) {
  const canvas = document.createElement("canvas");
  canvas.width = w * pixelRatio;
  canvas.height = h * pixelRatio;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D контекст не доступен");
  }
  ctx.scale(pixelRatio, pixelRatio);
  return ctx;
}

const getGradientData = (height, colorStops, getColor) => {
  const ctx = makeCtx(1, height);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, height, height);

  colorStops.forEach((stop) => {
    gradient.addColorStop(stop.position, getColor(stop));
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  return ctx.getImageData(0, 0, 1, height);
};

const colorStops = [
  { position: 0, color: "red", opacity: 0.0 },
  { position: 0.25, color: "orange", opacity: 0.5 },
  { position: 0.5, color: "white", opacity: 1.0 }
];

const gradData = getGradientData(25, colorStops, (stop) => stop.color);
const gradMaskData = getGradientData(
  25,
  colorStops,
  (stop) => `hsl(0deg, 0%, ${stop.opacity * 100}%)`
);

const drawLine = regl({
  vert: `
      precision mediump float;
      
      attribute vec2 position;
      
      varying vec2 uv;
  
      void main() {
        uv = 0.5 * (1.0 - position);
        gl_Position = vec4(position, 0, 1);
      }
    `,

  frag: `
      precision mediump float;
      
      uniform sampler2D texture;
      uniform sampler2D maskTexture;
      
      varying vec2 uv;

      void main() {
        gl_FragColor = vec4(
          texture2D(texture, uv).rgb,
          texture2D(maskTexture, uv).r
        );
      }
    `,

  attributes: {
    position: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1]
    ]
  },

  uniforms: {
    texture: regl.prop("texture"),
    maskTexture: regl.prop("maskTexture")
  },
  blend: {
    enable: true,
    func: {
      srcRGB:   'src alpha',
      srcAlpha: 'src alpha',
      dstRGB:   'one minus src alpha',
      dstAlpha: 'one minus src alpha'
    }
  },
  count: 6

  // primitive: 'lines'
});

const ctx = makeCtx(window.innerWidth, window.innerHeight);
const maskCtx = makeCtx(window.innerWidth, window.innerHeight);
const texture = regl.texture(ctx);
const maskTexture = regl.texture(maskCtx);

ctx.lineJoin = "round";
ctx.lineCap = "round";

maskCtx.lineJoin = "round";
maskCtx.lineCap = "round";

const drawOnCtx = (ctx, data, e, cy) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  const cx = window.innerWidth / 2
  const step = 1
  
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  
  for (let i = 0; i < 5; i++) {
    // ctx.lineTo(i * 50, cy + Math.sin(e + i * 3) * 200);
    
    // ctx.lineTo(
    //   cx + Math.cos(i * 10 + e) * (200 + i * 10),
    //   cy + Math.sin(i * 10 + e) * (200 + i * 10)
    // )
    
    ctx.bezierCurveTo(
      cx + Math.cos(i * 20 + e + i * 50) * (100 + i * 10 + e),
      cy + Math.sin(i * 20 + e + i * 50) * (100 + i * 10 + e),
      cx + Math.cos(i * 30 + e * 2) * (200 + i * 40 + i),
      cy + Math.sin(i * 30 + e * 2) * (200 + i * 40 + i),
      cx + Math.cos(i * 10) * (300 + i * 10),
      cy + Math.sin(i * 10) * (300 + i * 10),
    )
  }
  
  for (let l = 25; l > 0; l-=step) {
    ctx.lineWidth = l * 2;

    const r = data.data[l * 4];
    const g = data.data[l * 4 + 1];
    const b = data.data[l * 4 + 2];

    ctx.strokeStyle = `
      rgba(${r},${g},${b},${1})
    `;

    ctx.stroke();
  }
};

const count = 3;
const textures = [];

for (let i = 0; i < count; i++) {
  textures.push({
    base: regl.texture(ctx),
    mask: regl.texture(maskCtx)
  });
}

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1]
  });

  for (let i = 0; i < count; i++) {
    const time = performance.now() / 1000;
    const e = time + i;
    const { base, mask } = textures[i];
    
    const cy = window.innerHeight / 2

    drawOnCtx(ctx, gradData, e, cy);
    drawOnCtx(maskCtx, gradMaskData, e, cy);

    base.subimage(ctx);
    mask.subimage(maskCtx);

    drawLine({
      texture: base,
      maskTexture: mask
    });

    regl.clear({
      depth: 1
    });
  }
});