import * as THREE from 'three';
import type { SeasonPalette } from '../seasons';
import { Terrain } from '../../world/terrain';
import { Nav } from '../../world/nav';
import { Batcher } from '../../world/batch';
import { buildBuildings, buildGate, ElevatorTower } from '../../world/buildings';
import {
  buildDecks,
  buildLampGlow,
  buildLamps,
  buildSeats,
  buildSigns,
  buildSmallProps,
  buildStreamRocks,
  buildWoodpiles,
  type DeckTri,
  type SeatRT,
  type SignRT,
} from '../../world/props';
import { buildVegetation, wind, type Vegetation } from '../../world/vegetation';
import { buildRidges, buildSky, buildStars } from '../../world/sky';
import { FallingLeaves, LightMotes } from '../../world/particles';
import { buildAnimals } from '../../world/animals';
import { POINT_LIGHTS } from './layout';

export interface World {
  scene: THREE.Scene;
  terrain: Terrain;
  nav: Nav;
  seats: SeatRT[];
  signs: SignRT[];
  elevator: ElevatorTower;
  deckTris: DeckTri[];
  sun: THREE.DirectionalLight;
  sunDir: THREE.Vector3;
  fog: THREE.FogExp2;
  /** 매 프레임: 바람·물·낙엽·하늘 */
  update(dt: number, t: number, camera: THREE.Camera, focus: THREE.Vector3): void;
  /** 저사양 자동 조절 */
  setQuality(high: boolean): void;
}

/**
 * 국립대전숲체원 장면 조립.
 * 새 숲을 추가할 때는 이 폴더를 본떠 src/scenes/<id>/ 를 만들면 됩니다.
 */
export function buildDaejeonWorld(season: SeasonPalette, opts: { mobile: boolean; reducedMotion: boolean }): World {
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(season.fog, season.fogDensity);
  scene.fog = fog;
  scene.background = new THREE.Color(season.sky.mid);

  // 지형·길·개울
  const terrain = new Terrain(season);
  scene.add(terrain.buildMesh());
  scene.add(terrain.buildPaths());
  scene.add(terrain.buildStream());
  const groundY = (x: number, z: number): number => terrain.groundY(x, z);
  const nav = new Nav(groundY);
  const heightAt = (x: number, z: number, level: 0 | 1): number => nav.heightAt(x, z, level);

  // 건물과 소품(한 덩어리로 합쳐 그림)
  const b = new Batcher();
  buildBuildings(b, groundY, season);
  scene.add(buildGate(b, groundY, season));
  const elevator = new ElevatorTower(b, groundY, season);
  scene.add(elevator.group);
  const deckTris = buildDecks(b, groundY);
  const seats = buildSeats(b, heightAt);
  const lampHeads = buildLamps(b, heightAt, season);
  const { signs, group: signGroup } = buildSigns(b, heightAt);
  scene.add(signGroup);
  buildWoodpiles(b, groundY);
  buildStreamRocks(b, terrain);
  buildSmallProps(b, groundY);
  for (const m of b.build()) scene.add(m);
  scene.add(buildLampGlow(lampHeads, season));

  // 나무·수풀
  const vegetation: Vegetation = buildVegetation(terrain, season);
  scene.add(vegetation.group);

  // 고양이·다람쥐
  const animals = buildAnimals(groundY);
  scene.add(animals.group);

  // 하늘·별·원경 능선
  const sky = buildSky(season);
  const stars = buildStars();
  scene.add(sky, stars, buildRidges(season));

  // 조명: 따뜻한 방향광 하나(그림자) + 하늘빛 + 정원등 포인트 라이트 6개
  const sunDir = new THREE.Vector3(...season.sun.dir).normalize();
  const sun = new THREE.DirectionalLight(season.sun.color, season.sun.intensity);
  sun.castShadow = true;
  const size = opts.mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  const sc = sun.shadow.camera;
  sc.left = -44;
  sc.right = 44;
  sc.top = 44;
  sc.bottom = -44;
  sc.near = 10;
  sc.far = 220;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(season.hemi.sky, season.hemi.ground, season.hemi.intensity));
  scene.add(new THREE.AmbientLight(season.ambient.color, season.ambient.intensity));
  for (const p of POINT_LIGHTS) {
    const l = new THREE.PointLight(season.lamp, p.intensity, p.distance, 1.7);
    const y = p.y > 8 ? p.y : groundY(p.x, p.z) + p.y;
    l.position.set(p.x, y, p.z);
    scene.add(l);
  }

  // 파티클
  const leaves = new FallingLeaves(season, opts.mobile ? 70 : 130);
  const motes = new LightMotes(lampHeads, season, opts.mobile ? 4 : 7);
  scene.add(leaves.mesh, motes.points);
  if (opts.reducedMotion) {
    leaves.mesh.visible = false;
    motes.points.visible = false;
  }

  let high = true;
  const starMat = stars.material as THREE.ShaderMaterial;

  return {
    scene,
    terrain,
    nav,
    seats,
    signs,
    elevator,
    deckTris,
    sun,
    sunDir,
    fog,
    update(dt, t, camera, focus) {
      wind.uTime.value = opts.reducedMotion ? 0 : t;
      if (terrain.waterMaterial) terrain.waterMaterial.uniforms.uTime.value = t;
      starMat.uniforms.uTime.value = t;
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      // 그림자는 아바타 둘레만
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 110);
      animals.update(dt, t, focus, opts.reducedMotion);
      if (high && !opts.reducedMotion) {
        leaves.update(dt, t, camera.position, groundY);
        motes.update(t);
      }
    },
    setQuality(h) {
      high = h;
      sun.castShadow = h;
      leaves.mesh.visible = h && !opts.reducedMotion;
      motes.points.visible = h && !opts.reducedMotion;
      vegetation.setDetail(h);
      fog.density = season.fogDensity * (h ? 1 : 1.3);
    },
  };
}
