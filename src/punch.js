import { MathUtils, Quaternion, Vector3 } from 'three';

const duration = 900;
const up = new Vector3(0, 1, 0);

export function createPunch(root) {
  const names = [
    'Spine01', 'Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightArm', 'RightForeArm', 'RightHand',
  ];
  const bones = Object.fromEntries(names.map((name) => [name, root.getObjectByName(name)]));
  if (names.some((name) => !bones[name]?.isBone)) return null;

  const rest = names.map((name) => bones[name].quaternion.clone());
  const origin = new Vector3();
  const direction = new Vector3();
  const target = new Vector3();
  const rotation = new Quaternion();
  const parentRotation = new Quaternion();

  function turn(bone, worldRotation) {
    bone.parent.getWorldQuaternion(parentRotation);
    rotation.copy(parentRotation).invert().multiply(worldRotation).multiply(parentRotation);
    bone.quaternion.premultiply(rotation);
  }

  function aim(bone, child, x, y, z) {
    bone.getWorldPosition(origin);
    child.getWorldPosition(direction).sub(origin).normalize();
    target.set(x, y, z).normalize();
    turn(bone, new Quaternion().setFromUnitVectors(direction, target));
  }

  function restore() {
    names.forEach((name, i) => bones[name].quaternion.copy(rest[i]));
  }

  function pose(reach) {
    const { Spine01, Spine, LeftShoulder, LeftArm, LeftForeArm, LeftHand,
      RightArm, RightForeArm, RightHand } = bones;
    const twist = reach ? -.26 : .10;
    turn(Spine01, new Quaternion().setFromAxisAngle(up, twist * .4));
    turn(Spine, new Quaternion().setFromAxisAngle(up, twist * .6));
    if (reach) {
      turn(LeftShoulder, new Quaternion().setFromAxisAngle(up, -.28));
      aim(LeftArm, LeftForeArm, .12, -.13, .98);
      aim(LeftForeArm, LeftHand, -.08, .06, 1);
    } else {
      aim(LeftArm, LeftForeArm, .35, -.83, .43);
      aim(LeftForeArm, LeftHand, -.38, .84, .39);
    }
    aim(RightArm, RightForeArm, -.33, -.84, .42);
    aim(RightForeArm, RightHand, .42, .86, .27);
    return names.map((name) => bones[name].quaternion.clone());
  }

  const guard = pose(false);
  restore();
  const extension = pose(true);
  restore();

  let startedAt = null;
  const work = new Quaternion();
  return {
    start() {
      if (startedAt === null) startedAt = performance.now();
    },
    update(now) {
      if (startedAt === null) return;
      const phase = (now - startedAt) / duration;
      if (phase >= 1) {
        restore();
        startedAt = null;
        return;
      }
      const raise = MathUtils.smoothstep(phase, 0, .29) * (1 - MathUtils.smoothstep(phase, .70, 1));
      const strike = MathUtils.smoothstep(phase, .29, .50) * (1 - MathUtils.smoothstep(phase, .52, .70));
      names.forEach((name, i) => {
        work.copy(guard[i]).slerp(extension[i], strike);
        bones[name].quaternion.copy(rest[i]).slerp(work, raise);
      });
    },
  };
}
