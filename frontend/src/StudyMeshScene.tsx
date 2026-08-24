import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DroneAppearance, FlightCue } from './types';

export type StudyMeshViewMode = 'observer' | 'resident' | 'camera';

type BuildingFeature = {
  properties: {
    building_id?: string;
    height_m?: number;
    osm_id?: number;
    semantic_type?: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
};

type BuildingCollection = {
  features: BuildingFeature[];
};

type SceneRuntime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  uav: THREE.Group;
  balconyTarget: THREE.Group;
  cameraFrustum: THREE.Group;
  strobeLight: THREE.PointLight | null;
  update: (time: number, isHighExposure: boolean, reveal: boolean) => void;
  resize: () => void;
  dispose: () => void;
};

const ORIGIN = { lon: 114.1708, lat: 22.3182 };
const BUILDING_RADIUS_M = 270;
const BUILDINGS_URL = '/scenarios/hong_kong_mong_kok_01/osm_buildings.geojson';
const DURATION_SECONDS = 24;
const CAMERA_HFOV_DEG = 68;
const CAMERA_ASPECT = 16 / 9;
const CAMERA_VFOV_DEG = THREE.MathUtils.radToDeg(
  2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA_HFOV_DEG) / 2) / CAMERA_ASPECT),
);
const CAMERA_MAX_DEPTH_M = 165;

let buildingDataPromise: Promise<BuildingCollection> | null = null;

interface StudyMeshSceneProps {
  mode: StudyMeshViewMode;
  time: number;
  isHighExposure?: boolean;
  reveal?: boolean;
  droneAppearance?: DroneAppearance;
  flightCue?: FlightCue;
}

export const StudyMeshScene: React.FC<StudyMeshSceneProps> = ({
  mode,
  time,
  isHighExposure = false,
  reveal = false,
  droneAppearance,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    const host = hostRef.current;
    if (!host) return;

    loadBuildingData()
      .then((buildings) => {
        if (!active || !hostRef.current) return;
        const runtime = createSceneRuntime(hostRef.current, mode, buildings, droneAppearance);
        runtimeRef.current = runtime;
        runtime.update(time, isHighExposure, reveal);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('3D mesh loading error:', err);
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [mode, droneAppearance?.has_police_marking, droneAppearance?.has_strobe_light]);

  useEffect(() => {
    runtimeRef.current?.update(time, isHighExposure, reveal);
  }, [time, isHighExposure, reveal]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center select-none" ref={hostRef}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sky-400 text-xs font-semibold">
          正在加载 3D 建筑物与实体网格场景...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-amber-400 text-xs font-semibold">
          3D 场景初始化中...
        </div>
      )}
    </div>
  );
};

function loadBuildingData(): Promise<BuildingCollection> {
  if (!buildingDataPromise) {
    buildingDataPromise = fetch(BUILDINGS_URL).then((response) => {
      if (!response.ok) throw new Error(`Building data failed with ${response.status}`);
      return response.json() as Promise<BuildingCollection>;
    });
  }
  return buildingDataPromise;
}

function createSceneRuntime(
  host: HTMLDivElement,
  mode: StudyMeshViewMode,
  buildings: BuildingCollection,
  droneAppearance?: DroneAppearance,
): SceneRuntime {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5d7);
  scene.fog = new THREE.FogExp2(0xb9ced4, 0.0012);
  addPhysicalSky(scene);

  const camera = new THREE.PerspectiveCamera(
    mode === 'observer' ? 52 : mode === 'resident' ? 65 : CAMERA_VFOV_DEG,
    1,
    0.5,
    1400,
  );
  camera.up.set(0, 1, 0);

  scene.add(new THREE.HemisphereLight(0xeaf5f3, 0x4a5b54, 2.2));
  const sun = new THREE.DirectionalLight(0xffe8c8, 4.0);
  sun.position.set(-180, 300, 160);
  sun.castShadow = true;
  scene.add(sun);

  addGround(scene);
  addBuildingMeshes(scene, buildings);
  addStreetContext(scene);

  // Balcony target at 6F (y ~ 24m)
  const balconyTarget = createBalconyTarget();
  scene.add(balconyTarget);

  // UAV 3D Model
  const uav = createUavModel(droneAppearance);
  uav.visible = mode !== 'camera';
  scene.add(uav);

  // Strobe light for police drone
  let strobeLight: THREE.PointLight | null = null;
  if (droneAppearance?.has_strobe_light) {
    strobeLight = new THREE.PointLight(0xff0033, 5, 25);
    uav.add(strobeLight);
  }

  // Camera Frustum
  const cameraFrustum = createCameraFrustum(CAMERA_HFOV_DEG, CAMERA_ASPECT, CAMERA_MAX_DEPTH_M);
  cameraFrustum.visible = false;
  scene.add(cameraFrustum);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  // Fixed Anchor Positions
  const observerPosition = new THREE.Vector3(-140, 85, 340);
  const observerLookAt = new THREE.Vector3(20, 45, 0);
  const balconyPosition = new THREE.Vector3(38, 24, 18); // 6F Balcony
  const awayLookAt = new THREE.Vector3(-120, 10, 80);

  const dronePosition = new THREE.Vector3();
  const gimbalPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  const update = (time: number, isHighExposure: boolean, reveal: boolean) => {
    const progress = THREE.MathUtils.clamp(time / DURATION_SECONDS, 0, 1);

    // Flight trajectory based on scenario exposure level
    if (isHighExposure) {
      // High exposure: drone flies close and hovers facing the 6F balcony
      dronePosition.set(
        THREE.MathUtils.lerp(-110, 110, progress),
        32 + Math.sin(progress * Math.PI) * 4,
        42 - Math.sin(progress * Math.PI) * 16,
      );
      // Gimbal looks towards resident's balcony during middle segment
      const aimBalcony = smoothstep(0.25, 0.45, progress) * (1.0 - smoothstep(0.75, 0.95, progress));
      cameraTarget.lerpVectors(awayLookAt, balconyPosition, aimBalcony);
    } else {
      // Low exposure: drone flies at higher corridor, gimbal points to street
      dronePosition.set(
        THREE.MathUtils.lerp(-150, 150, progress),
        68 + Math.sin(progress * Math.PI) * 6,
        -10 - Math.sin(progress * Math.PI) * 12,
      );
      cameraTarget.copy(awayLookAt);
    }

    uav.position.copy(dronePosition);
    uav.rotation.y = Math.atan2(200, 10);
    gimbalPosition.copy(dronePosition);
    gimbalPosition.y -= 1.5;

    // Strobe blinking effect
    if (strobeLight) {
      const blink = Math.sin(time * 16) > 0 ? 8 : 0;
      strobeLight.intensity = blink;
      strobeLight.color.setHex(Math.sin(time * 8) > 0 ? 0xff0033 : 0x0066ff);
    }

    // View Modes Handling
    if (mode === 'observer') {
      camera.position.copy(observerPosition);
      camera.lookAt(observerLookAt);
      cameraFrustum.visible = reveal;
      positionCameraFrustum(cameraFrustum, gimbalPosition, cameraTarget);
    } else if (mode === 'resident') {
      // Resident on 6F Balcony looking up at drone in sky (pitch ~ 25 deg)
      camera.position.copy(balconyPosition);
      camera.lookAt(dronePosition.clone().add(new THREE.Vector3(0, 4, 0)));
      cameraFrustum.visible = reveal;
      positionCameraFrustum(cameraFrustum, gimbalPosition, cameraTarget);
    } else {
      // Camera mode: UAV in-flight camera viewpoint
      camera.position.copy(gimbalPosition);
      camera.lookAt(cameraTarget);
      camera.fov = CAMERA_VFOV_DEG;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    update(0, false, false);
  });
  resizeObserver.observe(host);
  resize();

  return {
    renderer,
    scene,
    camera,
    uav,
    balconyTarget,
    cameraFrustum,
    strobeLight,
    update,
    resize,
    dispose: () => {
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function addPhysicalSky(scene: THREE.Scene) {
  const sky = new Sky();
  sky.scale.setScalar(8000);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 3.1;
  uniforms.rayleigh.value = 1.25;
  uniforms.mieCoefficient.value = 0.006;
  uniforms.mieDirectionalG.value = 0.82;
  const elevation = THREE.MathUtils.degToRad(32);
  const azimuth = THREE.MathUtils.degToRad(225);
  uniforms.sunPosition.value.setFromSphericalCoords(1, Math.PI / 2 - elevation, azimuth);
  scene.add(sky);
}

function addGround(scene: THREE.Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({ color: 0x6e8077, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function addBuildingMeshes(scene: THREE.Scene, collection: BuildingCollection) {
  const geometryGroups = new Map<string, THREE.BufferGeometry[]>();

  for (const feature of collection.features) {
    if (feature.geometry.type !== 'Polygon') continue;
    const ring = feature.geometry.coordinates[0];
    if (ring.length < 4) continue;
    const localRing = ring.map(([lon, lat]) => lonLatToLocal(lon, lat));
    const centroid = localRing.reduce((sum, p) => sum.add(p), new THREE.Vector2()).multiplyScalar(1 / localRing.length);
    if (centroid.length() > BUILDING_RADIUS_M) continue;

    const shape = new THREE.Shape();
    localRing.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, -p.y);
      else shape.lineTo(p.x, -p.y);
    });

    const height = THREE.MathUtils.clamp(Number(feature.properties.height_m ?? 36), 10, 140);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();

    const semantic = feature.properties.semantic_type ?? 'residential';
    const group = geometryGroups.get(semantic) ?? [];
    group.push(geometry);
    geometryGroups.set(semantic, group);
  }

  for (const [semantic, geometries] of geometryGroups) {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;

    const material = new THREE.MeshStandardMaterial({
      color: semantic.includes('commercial') ? 0x9faeae : 0xc2c0b4,
      roughness: 0.75,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(merged, 25),
      new THREE.LineBasicMaterial({ color: 0x3d4a46, transparent: true, opacity: 0.15 }),
    );
    scene.add(edges);
  }
}

function addStreetContext(scene: THREE.Scene) {
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4240, roughness: 0.95 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 24), roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.15, 20);
  scene.add(road);
}

function createBalconyTarget() {
  const group = new THREE.Group();
  // 6F Balcony Railing Structure
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x22332e, roughness: 0.8 });
  const railing = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 0.1), railMaterial);
  railing.position.set(38, 24, 18);

  // Resident 3D avatar marker
  const residentMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
  });
  const resident = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.7, 12), residentMaterial);
  resident.position.set(38, 24.8, 17.5);

  group.add(railing, resident);
  return group;
}

function createUavModel(droneAppearance?: DroneAppearance) {
  const group = new THREE.Group();
  const isPolice = droneAppearance?.has_police_marking;

  // Police body: Navy blue / white stripe; Standard body: dark metallic
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1e3a8a : 0x242b29,
    roughness: 0.35,
    metalness: isPolice ? 0.2 : 0.6,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.5, 3.2), bodyMaterial);
  body.castShadow = true;
  group.add(body);

  if (isPolice) {
    // White stripe in the middle
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.62, 0.4, 3.22),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }),
    );
    group.add(stripe);
  }

  // 4 Arms and Rotors
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0x181e1d, roughness: 0.5 });
  for (const [x, z] of [[-4.2, -3], [4.2, -3], [-4.2, 3], [4.2, 3]]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 5, 8), armMaterial);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(z, x);
    arm.position.set(x * 0.5, 0, z * 0.5);

    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, transparent: true, opacity: 0.7 }),
    );
    rotor.position.set(x, 0.45, z);
    group.add(arm, rotor);
  }

  // Gimbal Camera
  const cameraSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 }),
  );
  cameraSphere.position.set(0, -1.1, 1.2);
  group.add(cameraSphere);

  group.scale.setScalar(1.5);
  return group;
}

function createCameraFrustum(hfovDeg: number, aspect: number, farDepth: number) {
  const group = new THREE.Group();
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(hfovDeg) / 2) * farDepth;
  const halfHeight = halfWidth / aspect;
  const apex = new THREE.Vector3(0, 0, 0);
  const corners = [
    new THREE.Vector3(-halfWidth, halfHeight, farDepth),
    new THREE.Vector3(halfWidth, halfHeight, farDepth),
    new THREE.Vector3(halfWidth, -halfHeight, farDepth),
    new THREE.Vector3(-halfWidth, -halfHeight, farDepth),
  ];

  const sidePositions: number[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const next = (index + 1) % corners.length;
    sidePositions.push(
      apex.x, apex.y, apex.z,
      corners[index].x, corners[index].y, corners[index].z,
      corners[next].x, corners[next].y, corners[next].z,
    );
  }
  const sideGeometry = new THREE.BufferGeometry();
  sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
  sideGeometry.computeVertexNormals();
  const sides = new THREE.Mesh(
    sideGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const edgePositions: number[] = [];
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    edgePositions.push(apex.x, apex.y, apex.z, corner.x, corner.y, corner.z);
    edgePositions.push(corner.x, corner.y, corner.z, next.x, next.y, next.z);
  });
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edges = new THREE.LineSegments(
    edgeGeometry,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 }),
  );
  group.add(sides, edges);
  return group;
}

function positionCameraFrustum(
  frustum: THREE.Group,
  origin: THREE.Vector3,
  target: THREE.Vector3,
) {
  const direction = target.clone().sub(origin).normalize();
  frustum.position.copy(origin);
  frustum.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
}

function lonLatToLocal(lon: number, lat: number) {
  const metersPerLon = 111_320 * Math.cos(THREE.MathUtils.degToRad(ORIGIN.lat));
  return new THREE.Vector2((lon - ORIGIN.lon) * metersPerLon, (lat - ORIGIN.lat) * 111_320);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const normalized = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}
