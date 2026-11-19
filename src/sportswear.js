import { Color } from 'three';

const palette = {
  jersey: new Color('#168f89'),
  panels: new Color('#083944'),
  joggers: new Color('#192f47'),
  trim: new Color('#f5bb62'),
};

export function applySportswear(root) {
  // The uploaded rig has one skinned mesh with the original clothes baked into
  // its texture. Work in bind-pose coordinates so graphics follow the joints.
  const mesh = root.getObjectByName('char1');
  if (!mesh?.isSkinnedMesh || !mesh.material.isMeshStandardMaterial || !mesh.material.map) return;

  mesh.material.onBeforeCompile = (shader) => {
    for (const [name, color] of Object.entries(palette)) {
      shader.uniforms[name + 'Color'] = { value: color };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOutfitPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOutfitPosition = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOutfitPosition;
        uniform vec3 jerseyColor;
        uniform vec3 panelsColor;
        uniform vec3 joggersColor;
        uniform vec3 trimColor;
      `)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 original = diffuseColor.rgb;
        vec3 p = vOutfitPosition;
        float side = abs(p.x);
        float denim = smoothstep(.007, .040, original.b - original.r);
        float flannel = smoothstep(.12, .36, (original.r - original.g) / max(original.r, .025))
          * smoothstep(.035, .075, original.r);
        float torso = smoothstep(1.015, 1.060, p.y)
          * (1.0 - smoothstep(1.330, 1.420, p.y));
        float sleeves = smoothstep(1.080, 1.130, p.y)
          * (1.0 - smoothstep(1.345, 1.405, p.y))
          * (1.0 - smoothstep(.303, .355, side));
        float topMask = max(denim * torso, flannel * max(torso * (1.0 - smoothstep(.21, .29, side)), sleeves));
        float pantsMask = denim * smoothstep(.295, .400, p.y)
          * (1.0 - smoothstep(1.025, 1.065, p.y));
        float pocket = smoothstep(.13, .165, side) * (1.0 - smoothstep(.226, .258, side))
          * smoothstep(.862, .905, p.y) * (1.0 - smoothstep(1.002, 1.037, p.y))
          * smoothstep(.030, .070, original.g - original.b);
        float sidePanel = smoothstep(.122, .165, side);
        vec3 top = mix(jerseyColor, panelsColor, sidePanel);
        float stripe = 1.0 - smoothstep(.007, .013, abs(side - .153));
        vec3 pants = mix(joggersColor, trimColor, stripe * .68);
        float seam = 1.0 - smoothstep(.008, .019, abs(p.y - 1.066));
        float front = smoothstep(.070, .128, p.z);
        float chevron = 1.0 - smoothstep(.006, .012, abs(p.y - (1.225 + side * .67)));
        top = mix(top, trimColor, max(seam * .83, chevron * front * (1.0 - sidePanel)));
        float fabricLight = mix(.74, 1.16, smoothstep(.030, .40, dot(original, vec3(.2126, .7152, .0722))));
        diffuseColor.rgb = mix(original, pants * fabricLight, pantsMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, joggersColor * fabricLight, pocket);
        diffuseColor.rgb = mix(diffuseColor.rgb, top * fabricLight, topMask);
      `);
  };
  mesh.material.customProgramCacheKey = () => 'farmer-woman-sportswear';
}
