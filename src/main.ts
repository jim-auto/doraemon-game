import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { TextureLoader } from 'three'
import './style.css'

type Keys = Record<string, boolean>

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div id="hud">
    <div class="brand">日本誕生編 <span>prototype 02</span></div>
    <div id="objective">7万年前の日本を探検しよう</div>
    <div id="gadget">ひみつ道具：空気砲</div>
    <div id="enemy-status" class="hidden">土偶の守護者 HP：■■■</div>
    <div id="message">WASD / 矢印キーで移動　・　Eで調べる</div>
  </div>
  <div id="crosshair">＋</div>
  <div id="complete" class="hidden"><div>原始の森を抜けた！</div><small>時空の旅はまだ始まったばかり</small></div>
`

THREE.ColorManagement.enabled = true
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x9bbab5)
scene.fog = new THREE.FogExp2(0x9bbab5, 0.013)

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 150)
camera.position.set(0, 7, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.65, 0.86)
composer.addPass(bloom)
composer.addPass(new OutputPass())

scene.add(new THREE.HemisphereLight(0xbadfe2, 0x3c2b25, 1.55))
scene.add(new THREE.AmbientLight(0x8fa89d, 0.32))
const sun = new THREE.DirectionalLight(0xffd3a1, 3.5)
sun.position.set(-12, 22, 8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -30
sun.shadow.camera.right = 30
sun.shadow.camera.top = 30
sun.shadow.camera.bottom = -30
scene.add(sun)

function makeTexture(base: string, accent: string, repeat: [number, number]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = Math.random() > 0.55 ? accent : base
    const size = Math.random() * 4 + 1
    ctx.globalAlpha = Math.random() * 0.22 + 0.04
    ctx.fillRect(Math.random() * 256, Math.random() * 256, size, size)
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(...repeat)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

function makeNormalTexture(repeat: [number, number]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(128,128,255)'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    const value = 112 + Math.random() * 32
    ctx.fillStyle = `rgb(${value},${value},255)`
    ctx.globalAlpha = 0.18
    ctx.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 5 + 1, Math.random() * 5 + 1)
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(...repeat)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

const stoneTexture = makeTexture('#77675a', '#d0b28c', [2.5, 2.5])
const floorTexture = makeTexture('#716b57', '#b6a982', [14, 14])
const stoneNormal = makeNormalTexture([2.5, 2.5])
const floorNormal = makeNormalTexture([14, 14])
const mat = (color: number, roughness = 0.85, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness, ...(map ? { map } : {}) })
const stone = mat(0xffffff, 0.96, stoneTexture)
const stoneLight = mat(0xffffff, 0.88, stoneTexture)
const floorMaterial = mat(0xffffff, 0.98, floorTexture)
floorMaterial.bumpMap = floorTexture
floorMaterial.bumpScale = 0.11
floorMaterial.normalMap = floorNormal
floorMaterial.normalScale.set(0.22, 0.22)

// Poly Haven's CC0 dirt_aerial_02 maps replace the procedural ground once loaded.
// This is the visual anchor: real albedo breakup, micro-normal detail and roughness
// variation keep the scene from reading as a flat painted game board.
const pbrLoader = new TextureLoader()
const pbrTexture = (file: string, color = false) => {
  const texture = pbrLoader.load(`/textures/dirt/${file}`)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(7.5, 7.5)
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
floorMaterial.map = pbrTexture('dirt_aerial_02_diff_2k.jpg', true)
floorMaterial.normalMap = pbrTexture('dirt_aerial_02_nor_gl_2k.jpg')
floorMaterial.roughnessMap = pbrTexture('dirt_aerial_02_rough_2k.jpg')
floorMaterial.aoMap = pbrTexture('dirt_aerial_02_ao_2k.jpg')
floorMaterial.bumpMap = pbrTexture('dirt_aerial_02_disp_2k.jpg')
floorMaterial.bumpScale = 0.035
floorMaterial.aoMapIntensity = 1.25
floorMaterial.normalScale.set(0.48, 0.48)
floorMaterial.needsUpdate = true
stone.normalMap = stoneNormal
stone.normalScale.set(0.28, 0.28)
stoneLight.normalMap = stoneNormal
stoneLight.normalScale.set(0.2, 0.2)
const groundGeometry = new THREE.PlaneGeometry(100, 100, 32, 32)
const groundVertices = groundGeometry.attributes.position
for (let i = 0; i < groundVertices.count; i++) {
  const x = groundVertices.getX(i)
  const z = groundVertices.getY(i)
  const edge = Math.max(Math.abs(x), Math.abs(z)) / 50
  const ripples = Math.sin(x * 0.32) * Math.cos(z * 0.23) * 0.18
  groundVertices.setZ(i, ripples + Math.max(0, edge - 0.62) * 2.5)
}
groundGeometry.computeVertexNormals()
const ground = new THREE.Mesh(groundGeometry, floorMaterial)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// A restrained atmospheric dome replaces the flat color backdrop with a deep
// sky-to-horizon gradient and a soft sun halo behind the mountain ridge.
const skyCanvas = document.createElement('canvas')
skyCanvas.width = 1024
skyCanvas.height = 512
const skyContext = skyCanvas.getContext('2d')!
const skyGradient = skyContext.createLinearGradient(0, 0, 0, 512)
skyGradient.addColorStop(0, '#6f9fa9')
skyGradient.addColorStop(0.52, '#a7c3bc')
skyGradient.addColorStop(1, '#6e8074')
skyContext.fillStyle = skyGradient
skyContext.fillRect(0, 0, 1024, 512)
const sunHalo = skyContext.createRadialGradient(710, 145, 5, 710, 145, 150)
sunHalo.addColorStop(0, 'rgba(255,238,190,0.48)')
sunHalo.addColorStop(0.35, 'rgba(255,225,170,0.16)')
sunHalo.addColorStop(1, 'rgba(255,225,170,0)')
skyContext.fillStyle = sunHalo
skyContext.fillRect(530, 0, 360, 300)
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(82, 32, 16),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCanvas), side: THREE.BackSide, depthWrite: false }),
)
scene.add(sky)

// External CC0 assets from Quaternius' Modular Dungeon pack.
// They are loaded as OBJ+MTL because the source pack provides that format.
const externalAssetBase = '/models/dungeon/'
function loadExternalModel(name: string, position: [number, number, number], scale: number, rotationY = 0) {
  const materials = new MTLLoader()
  materials.setPath(externalAssetBase)
  materials.load(`${name}.mtl`, (loadedMaterials) => {
    loadedMaterials.preload()
    const loader = new OBJLoader()
    loader.setMaterials(loadedMaterials)
    loader.setPath(externalAssetBase)
    loader.load(`${name}.obj`, (object) => {
      object.position.set(...position)
      object.rotation.y = rotationY
      object.scale.setScalar(scale)
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true }
      })
      scene.add(object)
    }, undefined, (error) => console.warn(`External model failed: ${name}`, error))
  })
}
loadExternalModel('Entrance', [0, 0, -14.5], 1.25)
loadExternalModel('Column_Broken', [-12, 0, -5], 1.25, 0.35)
loadExternalModel('Column_Broken2', [13, 0, 3], 1.2, -0.5)
loadExternalModel('Chest_gold', [5, 0, 7], 1.25, 0.4)
loadExternalModel('Torch', [-7, 0, -13], 1.2)
loadExternalModel('Torch', [7, 0, -13], 1.2, Math.PI)

function box(size: [number, number, number], position: [number, number, number], material = stone) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

// Natural cliffs frame the space; the authored entrance remains the focal point.
function cliff(x: number, z: number, scale: [number, number, number], rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), stone)
  mesh.position.set(x, scale[1] * 0.42, z)
  mesh.scale.set(...scale)
  mesh.rotation.y = rotation
  mesh.castShadow = mesh.receiveShadow = true
  scene.add(mesh)
}
for (const c of [
  [-18, -17, 4.5, 5.5, 3.4, 0.2], [18, -17, 4.2, 5.0, 3.2, -0.4],
  [-22, -6, 3.6, 5.8, 4.1, 0.6], [22, -4, 4.4, 6.2, 3.5, -0.3],
  [-21, 9, 4.6, 5.4, 3.8, 0.4], [21, 10, 4.2, 5.8, 3.6, -0.6],
  [-15, 18, 4.6, 4.2, 3.0, 0.1], [15, 18, 5.0, 4.4, 3.1, -0.2],
] as [number, number, number, number, number, number][]) cliff(c[0], c[1], [c[2], c[3], c[4]], c[5])

// Layered escarpments and a distant ridge give the wilderness a real horizon.
// The player should read a valley, not a room filled with separate props.
const deepStone = mat(0x5c5148, 0.98, stoneTexture)
const mossStone = mat(0x7d7965, 0.96, stoneTexture)
function rockMass(position: [number, number, number], scale: [number, number, number], material = deepStone, detail = 1) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.rotation.set(Math.random() * 0.25, Math.random() * Math.PI, Math.random() * 0.18)
  mesh.castShadow = mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}
for (const [x, z, sx, sy, sz] of [
  [-25, -27, 7, 7, 5], [-16, -30, 8, 9, 6], [-6, -33, 7, 8, 5], [5, -32, 9, 10, 6], [16, -29, 8, 8, 5], [26, -26, 7, 7, 5],
] as [number, number, number, number, number][]) rockMass([x, sy * 0.35, z], [sx, sy, sz], deepStone, 1)
for (const [x, z, s] of [[-19, -20, 3.5], [-14, -21, 2.8], [14, -21, 3.2], [19, -19, 2.7], [-23, 3, 3.1], [23, 4, 3.4]] as [number, number, number][]) {
  rockMass([x, s * 0.55, z], [s, s * 1.4, s * 0.8], mossStone, 1)
  rockMass([x + (x < 0 ? 1.2 : -1.2), s * 0.3, z + 1.1], [s * 0.7, s * 0.7, s * 0.9], deepStone, 1)
}

// Broken shelves read as eroded strata and hide the artificial square boundary.
for (const side of [-1, 1]) {
  for (let i = 0; i < 7; i++) {
    const z = -18 + i * 5.2
    const x = side * (18 + (i % 2) * 2.2)
    rockMass([x, 1.1 + (i % 3) * 0.55, z], [3.8, 1.4 + (i % 2) * 0.7, 1.5], i % 2 ? mossStone : deepStone, 1)
  }
}

function boulder(x: number, z: number, size: number, material = stoneLight) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), material)
  mesh.position.set(x, size * 0.62, z)
  mesh.scale.set(1.15, 0.72 + Math.random() * 0.3, 0.9)
  mesh.rotation.set(Math.random(), Math.random(), Math.random())
  mesh.castShadow = mesh.receiveShadow = true
  scene.add(mesh)
}
for (const p of [[-9, -5, 1.3], [9, -5, 1.1], [-9, 8, 1.5], [9, 8, 1.2], [-4, -10, 1.0], [6, 5, 1.25]] as [number, number, number][]) boulder(...p)

// A broken-stone ring creates a readable path to the altar.
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2
  boulder(Math.cos(angle) * 5.6, 2 + Math.sin(angle) * 3.6, 0.42 + (i % 3) * 0.1)
}

// Modular ruins: a few architectural columns around the authored gate.
function column(x: number, z: number, height = 5, broken = false) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, height, 10), stone)
  shaft.position.set(x, height / 2, z)
  shaft.castShadow = shaft.receiveShadow = true
  scene.add(shaft)
  box([2.1, 0.35, 2.1], [x, height + 0.18, z], stoneLight)
  box([1.7, 0.25, 1.7], [x, 0.12, z], stoneLight)
  if (broken) box([1.6, 0.8, 1.2], [x + 0.55, height + 0.7, z + 0.25], stone)
}
column(-6, -14, 4.7, true)
column(6, -14, 5.2, false)
// Gate surround and a stone arch silhouette at the far end.
box([2.2, 6, 1.6], [-3.8, 3, -15], stone)
box([2.2, 6, 1.6], [3.8, 3, -15], stone)
box([7.6, 1.8, 1.6], [0, 5.9, -15], stoneLight)
const arch = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.85, 8, 24, Math.PI), stone)
arch.rotation.z = Math.PI
arch.position.set(0, 5.8, -15)
arch.scale.y = 0.82
arch.castShadow = arch.receiveShadow = true
scene.add(arch)

// Small props make the space readable at game-camera distance.
for (let i = 0; i < 28; i++) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.random() * 0.45 + 0.18, 0), stoneLight)
  rock.position.set((Math.random() - 0.5) * 34, 0.2, (Math.random() - 0.5) * 27)
  rock.scale.y = Math.random() * 0.7 + 0.4
  rock.rotation.set(Math.random(), Math.random(), Math.random())
  rock.castShadow = rock.receiveShadow = true
  scene.add(rock)
}

function torch(x: number, z: number) {
  box([0.25, 2.2, 0.25], [x, 1.1, z], mat(0x433028, 0.95))
  const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), new THREE.MeshStandardMaterial({ color: 0xff9d36, emissive: 0xff4d16, emissiveIntensity: 5 }))
  flame.position.set(x, 2.45, z)
  scene.add(flame)
  const light = new THREE.PointLight(0xff7b37, 4, 9, 2)
  light.position.set(x, 2.4, z)
  light.castShadow = true
  scene.add(light)
}
torch(-7, -13); torch(7, -13); torch(-15, 12); torch(15, 12)

function primitiveTree(x: number, z: number, size: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * size, 0.42 * size, 3.2 * size, 9), mat(0x563b2c, 0.98))
  trunk.position.set(x, 1.4 * size, z)
  trunk.rotation.z = (Math.random() - 0.5) * 0.18
  trunk.castShadow = true
  scene.add(trunk)
  for (const [ox, oy, sx, sy, color] of [[0, 3.3, 1.5, 1.2, 0x315b42], [0.45, 4.35, 1.2, 1.0, 0x3d7650], [-0.35, 4.95, 0.82, 0.82, 0x568c5d]] as [number, number, number, number, number][]) {
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), mat(color, 0.96))
    canopy.position.set(x + ox * size, oy * size, z + (Math.random() - 0.5) * 0.3 * size)
    canopy.scale.set(sx, sy, 0.9)
    canopy.rotation.set(Math.random(), Math.random(), Math.random())
    canopy.castShadow = true
    scene.add(canopy)
  }
}
for (const tree of [[-15, -6, 1.5], [15, -7, 1.8], [-16, 6, 1.4], [16, 7, 1.6], [-11, 13, 1.2], [11, 13, 1.3]] as [number, number, number][]) primitiveTree(...tree)

// Dense backline vegetation creates scale and occlusion without blocking the route.
for (const tree of [
  [-12, -22, 0.85], [-8, -23, 0.7], [-3, -24, 0.62], [4, -24, 0.72], [10, -23, 0.9], [15, -21, 0.7],
  [-20, -15, 0.95], [20, -14, 0.92], [-20, 1, 0.85], [20, 2, 0.8], [-18, 13, 0.7], [18, 14, 0.72],
] as [number, number, number][]) primitiveTree(...tree)

// A lower layer of ferns and scrub breaks the clean horizon at the player's eye line.
const fernMaterials = [mat(0x294c35, 0.98), mat(0x3d6941, 0.98), mat(0x5c7e49, 0.98)]
function fern(x: number, z: number, size: number, material = fernMaterials[1]) {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07 * size, 1.5 * size, 5), material)
    leaf.position.y = 0.62 * size
    leaf.rotation.z = (i - 2) * 0.27
    leaf.rotation.y = i * 1.25
    leaf.castShadow = true
    group.add(leaf)
  }
  scene.add(group)
}
for (let i = 0; i < 34; i++) {
  const side = i % 2 ? 1 : -1
  fern(side * (8 + Math.random() * 10), -13 + Math.random() * 26, 0.45 + Math.random() * 0.65, fernMaterials[i % fernMaterials.length])
}

// Fallen trunks add scale cues and make the forest feel older than the ruins.
function fallenTrunk(x: number, z: number, length: number, rotation: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, length, 10), mat(0x49362a, 0.98))
  trunk.position.set(x, 0.42, z)
  trunk.rotation.z = Math.PI / 2
  trunk.rotation.y = rotation
  trunk.castShadow = trunk.receiveShadow = true
  scene.add(trunk)
  const cut = new THREE.Mesh(new THREE.CircleGeometry(0.33, 10), mat(0x8b6948, 0.98))
  cut.position.set(x + Math.cos(rotation) * length * 0.5, 0.42, z - Math.sin(rotation) * length * 0.5)
  cut.rotation.y = rotation + Math.PI / 2
  scene.add(cut)
}
fallenTrunk(-12, 10, 4.8, 0.25)
fallenTrunk(13, 13, 5.6, -0.45)

// An original clay-dogū altar and a glowing time-rift silhouette anchor the theme.
const clay = mat(0xa85e42, 0.9)
const clayDark = mat(0x713b31, 0.96)
const runeMaterial = new THREE.MeshStandardMaterial({ color: 0x7cf2df, emissive: 0x27aa9b, emissiveIntensity: 2.2, roughness: 0.42 })
const altar = new THREE.Group()
for (const [radius, height, y] of [[2.25, 0.28, 0.14], [1.75, 0.32, 0.43], [1.28, 0.22, 0.7]] as [number, number, number][]) {
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 12), stoneLight)
  slab.position.set(-10, y, -9)
  slab.castShadow = slab.receiveShadow = true
  altar.add(slab)
}
const altarRune = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.045, 6, 32), runeMaterial)
altarRune.position.set(-10, 0.83, -9)
altarRune.rotation.x = Math.PI / 2
altar.add(altarRune)
scene.add(altar)
const dogu = new THREE.Group()
const doguBody = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 1.55, 10), clay)
doguBody.position.y = 0.9
dogu.add(doguBody)
const doguHead = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), clay)
doguHead.position.y = 1.95
doguHead.scale.set(1.15, 0.95, 0.65)
dogu.add(doguHead)
for (const y of [0.55, 1.02, 1.48]) {
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.72 - (y - 0.55) * 0.08, 0.045, 6, 20), clayDark)
  band.position.y = y
  band.rotation.x = Math.PI / 2
  dogu.add(band)
}
for (const x of [-0.72, 0.72]) {
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 5, 8), clay)
  arm.position.set(x, 1.04, -0.02)
  arm.rotation.z = x < 0 ? -0.48 : 0.48
  dogu.add(arm)
}
for (const x of [-0.25, 0.25]) {
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0x241817, roughness: 1 }))
  hole.position.set(x, 2.05, -0.58)
  dogu.add(hole)
}
for (const x of [-0.42, 0.42]) {
  const cheek = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 5, 12), clayDark)
  cheek.position.set(x, 1.72, -0.56)
  cheek.rotation.x = Math.PI / 2
  dogu.add(cheek)
}
dogu.position.set(-10, 0, -9)
dogu.scale.setScalar(1.35)
dogu.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true })
scene.add(dogu)
const rift = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.18, 12, 48), new THREE.MeshStandardMaterial({ color: 0xb5f8ff, emissive: 0x3bbfe2, emissiveIntensity: 3, transparent: true, opacity: 0.85 }))
rift.position.set(0, 4.4, -14.7)
rift.rotation.x = Math.PI / 2
scene.add(rift)

// Player: a more deliberate, original blue robot-adventurer silhouette.
const player = new THREE.Group()
const blue = mat(0x247fb5, 0.72)
const blueDark = mat(0x155478, 0.86)
const white = mat(0xf6eee0, 0.7)
const black = mat(0x10151a, 0.55)
const red = mat(0xd8463f, 0.65)
const gold = mat(0xffc54d, 0.35)
function part<T extends THREE.Object3D>(object: T, position: [number, number, number], scale?: [number, number, number]) {
  object.position.set(...position)
  if (scale) object.scale.set(...scale)
  object.castShadow = true
  object.receiveShadow = true
  player.add(object)
  return object
}
part(new THREE.Mesh(new RoundedBoxGeometry(1.32, 1.48, 1.08, 5, 0.2), blue), [0, 1.28, 0])
part(new THREE.Mesh(new THREE.SphereGeometry(0.82, 28, 20), blue), [0, 2.25, -0.02], [1, 0.98, 0.95])
part(new THREE.Mesh(new THREE.SphereGeometry(0.57, 24, 18), white), [0, 2.12, -0.69], [1, 0.92, 0.36])
// Pocket and backpack shell give the silhouette detail from both camera sides.
part(new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.42, 0.12, 4, 0.07), blueDark), [0, 1.2, -0.57])
part(new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.92, 0.3, 5, 0.1), blueDark), [0, 1.24, 0.64])
for (const x of [-0.48, 0.48]) {
  const strap = part(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.98, 0.08, 3, 0.03), blue), [x, 1.28, 0.79])
  strap.rotation.z = x < 0 ? -0.17 : 0.17
}
for (const x of [-0.23, 0.23]) {
  part(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), white), [x, 2.42, -0.72])
  part(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), black), [x, 2.42, -0.85])
}
part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), red), [0, 2.18, -0.91])
const mouth = part(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16, Math.PI), black), [0, 2.01, -0.91])
mouth.rotation.set(0, 0, 0)
for (const side of [-1, 1]) {
  for (const y of [1.98, 2.12, 2.25]) {
    const whisker = part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), black), [side * 0.34, y, -0.84])
    whisker.rotation.z = side * (Math.PI / 2 + (y - 2.12) * 0.3)
  }
}
const collar = part(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.095, 8, 24), red), [0, 1.78, 0])
collar.rotation.x = Math.PI / 2
part(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), gold), [0, 1.68, -0.63])
part(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 6, 18), mat(0x8f5d23, 0.5)), [0, 1.68, -0.78])
part(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x4c3520, 0.8)), [0, 1.58, -0.79])
const walkArms: THREE.Object3D[] = []
const walkLegs: THREE.Object3D[] = []
for (const x of [-0.82, 0.82]) {
  const arm = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.58, 6, 10), blue), [x, 1.25, 0])
  arm.rotation.z = x < 0 ? -0.22 : 0.22
  walkArms.push(arm)
  part(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), blueDark), [x * 0.92, 1.42, 0])
  part(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), white), [x * 1.03, 0.83, -0.03])
}
for (const x of [-0.35, 0.35]) {
  const leg = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.4, 6, 10), blueDark), [x, 0.38, 0])
  walkLegs.push(leg)
  part(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), white), [x, 0.1, -0.12], [1.15, 0.65, 1.35])
}
part(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), red), [0, 1.06, 0.98])
part(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), red), [0, 1.06, 1.14])
player.position.set(0, 0, 11)
scene.add(player)

const switchBase = box([1.5, 0.35, 1.5], [0, 0.2, 1], stoneLight)
const switchOrb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(0x55e6d1, 0.35))
switchOrb.position.set(0, 1, 1)
switchOrb.castShadow = true
scene.add(switchOrb)
const switchPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 0.72, 10), stone)
switchPedestal.position.set(0, 0.58, 1)
switchPedestal.castShadow = switchPedestal.receiveShadow = true
scene.add(switchPedestal)
const switchHalo = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.055, 6, 28), runeMaterial)
switchHalo.position.set(0, 0.96, 1)
switchHalo.rotation.x = Math.PI / 2
scene.add(switchHalo)

// A small prehistoric firepit gives the empty mid-ground a believable human trace.
const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xffa33e, emissive: 0xff3b0f, emissiveIntensity: 4.5, roughness: 0.6 })
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2
  const stoneRing = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), stoneLight)
  stoneRing.position.set(-6 + Math.cos(a) * 1.25, 0.28, 5 + Math.sin(a) * 1.25)
  stoneRing.scale.y = 0.65
  stoneRing.castShadow = stoneRing.receiveShadow = true
  scene.add(stoneRing)
}
const ember = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), emberMaterial)
ember.position.set(-6, 0.68, 5)
scene.add(ember)
const fireLight = new THREE.PointLight(0xff7138, 2.5, 8, 2)
fireLight.position.set(-6, 1.2, 5)
scene.add(fireLight)

// The gate is intentionally open in the center so it does not occlude the player.
const door = box([5.2, 0.85, 0.9], [0, 5.9, -15], stoneLight)
let activated = false
let enemyHp = 3
let enemyDefeated = false
const enemy = new THREE.Group()
const enemyBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 0.9, 6, 12), mat(0x9c593e, 0.88))
enemyBody.position.y = 1.05
enemyBody.castShadow = true
enemy.add(enemyBody)
const enemyHead = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 12), mat(0xc8754c, 0.82))
enemyHead.position.y = 1.9
enemyHead.castShadow = true
enemy.add(enemyHead)
for (const x of [-0.2, 0.2]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0xff4b6e, 0.35))
  eye.position.set(x, 2, -0.58)
  eye.material.emissive = new THREE.Color(0xaa102d)
  eye.material.emissiveIntensity = 3
  enemy.add(eye)
}
const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.65, 8), mat(0xf0ba58, 0.5))
antenna.position.y = 2.75
enemy.add(antenna)
const antennaLight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff536f, emissive: 0xff1638, emissiveIntensity: 4 }))
antennaLight.position.y = 3.1
enemy.add(antennaLight)
enemy.position.set(0, 0, -4)
enemy.visible = false
enemy.castShadow = true
scene.add(enemy)
const projectiles: { mesh: THREE.Mesh; velocity: THREE.Vector3 }[] = []
const cannonEffects: { group: THREE.Group; life: number; maxLife: number }[] = []
let lastShotAt = -Infinity
let screenShake = 0
let audioContext: AudioContext | undefined
const keys: Keys = {}
addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase()
  keys[key] = true
  // A small discrete nudge makes one-shot keyboard events testable and also
  // keeps keyboard navigation responsive on browsers that miss key repeats.
  const nudge = 0.2
  if (key === 'w' || key === 'arrowup') { player.position.z -= nudge; player.rotation.y = 0 }
  if (key === 's' || key === 'arrowdown') { player.position.z += nudge; player.rotation.y = Math.PI }
  if (key === 'a' || key === 'arrowleft') { player.position.x -= nudge; player.rotation.y = Math.PI / 2 }
  if (key === 'd' || key === 'arrowright') { player.position.x += nudge; player.rotation.y = -Math.PI / 2 }
  if (key === 'e') interact()
  if (key === ' ' || key === 'spacebar' || e.code === 'Space') shootAirCannon()
})
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })
renderer.domElement.addEventListener('pointerdown', shootAirCannon)

function interact() {
  if (player.position.distanceTo(switchOrb.position) < 3.2 && !activated) {
    activated = true
    switchBase.material = mat(0x4fe3bf)
    switchOrb.material = mat(0xffd45c, 0.3)
    door.position.y = -3
    enemy.visible = true
    document.querySelector('#enemy-status')!.classList.remove('hidden')
    document.querySelector('#objective')!.textContent = '土偶の守護者を空気砲で倒そう'
    document.querySelector('#message')!.textContent = 'Space／クリックで空気砲を撃つ'
  }
}

function shootAirCannon() {
  if (!activated || enemyDefeated || clock.elapsedTime - lastShotAt < 0.28) return
  lastShotAt = clock.elapsedTime
  const direction = new THREE.Vector3(-Math.sin(player.rotation.y), 0, -Math.cos(player.rotation.y))
  const origin = player.position.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(direction, 1.0)
  const cannonMaterial = new THREE.MeshStandardMaterial({ color: 0xe5fdff, emissive: 0x4edfff, emissiveIntensity: 8, transparent: true, opacity: 0.9 })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), cannonMaterial)
  mesh.position.copy(origin).addScaledVector(direction, 0.5)
  mesh.castShadow = true
  scene.add(mesh)
  projectiles.push({ mesh, velocity: direction.multiplyScalar(14) })
  const effect = new THREE.Group()
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.08, 2.2, 16, 1, true), cannonMaterial)
  barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
  barrel.position.copy(origin).addScaledVector(direction, 0.9)
  effect.add(barrel)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.075, 8, 24), cannonMaterial)
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
  ring.position.copy(origin)
  effect.add(ring)
  scene.add(effect)
  cannonEffects.push({ group: effect, life: 0.22, maxLife: 0.22 })
  screenShake = 0.16
  player.position.addScaledVector(direction, -0.12)
  playCannonSound()
}

function playCannonSound() {
  try {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    audioContext ??= new Context()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(170, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(48, audioContext.currentTime + 0.16)
    gain.gain.setValueAtTime(0.16, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.18)
  } catch { /* Audio is optional when autoplay is blocked. */ }
}

const clock = new THREE.Clock()
const desiredCamera = new THREE.Vector3()
let walkTime = 0
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const direction = new THREE.Vector3(
    Number(keys.d || keys.arrowright) - Number(keys.a || keys.arrowleft),
    0,
    Number(keys.s || keys.arrowdown) - Number(keys.w || keys.arrowup),
  )
  if (direction.lengthSq() > 0) {
    direction.normalize()
    player.position.addScaledVector(direction, dt * 6)
    player.position.x = THREE.MathUtils.clamp(player.position.x, -17, 17)
    player.position.z = THREE.MathUtils.clamp(player.position.z, -13, 13)
    // The character mesh faces local -Z, so rotate its -Z axis into movement direction.
    player.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI
    walkTime += dt * 10
    player.position.y = Math.abs(Math.sin(walkTime)) * 0.045
    walkArms[0].rotation.x = Math.sin(walkTime) * 0.42
    walkArms[1].rotation.x = -Math.sin(walkTime) * 0.42
    walkLegs[0].rotation.x = -Math.sin(walkTime) * 0.32
    walkLegs[1].rotation.x = Math.sin(walkTime) * 0.32
  } else {
    player.position.y = THREE.MathUtils.lerp(player.position.y, 0, 0.15)
    walkArms.forEach((arm) => { arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, 0, 0.18) })
    walkLegs.forEach((leg) => { leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, 0.18) })
  }
  switchOrb.rotation.y += dt * 1.5
  for (let i = cannonEffects.length - 1; i >= 0; i--) {
    const effect = cannonEffects[i]
    effect.life -= dt
    const progress = 1 - effect.life / effect.maxLife
    effect.group.scale.setScalar(1 + progress * 0.8)
    effect.group.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) child.material.opacity = 1 - progress
    })
    if (effect.life <= 0) {
      scene.remove(effect.group)
      cannonEffects.splice(i, 1)
    }
  }
  if (activated && !enemyDefeated) {
    const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.position)
    toPlayer.y = 0
    if (toPlayer.length() > 2.2) enemy.position.addScaledVector(toPlayer.normalize(), dt * 1.35)
    enemy.lookAt(player.position.x, enemy.position.y + 1, player.position.z)
    antennaLight.scale.setScalar(1 + Math.sin(clock.elapsedTime * 8) * 0.12)
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i]
    projectile.mesh.position.addScaledVector(projectile.velocity, dt)
    if (!enemyDefeated && projectile.mesh.position.distanceTo(enemy.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.15) {
      enemyHp -= 1
      scene.remove(projectile.mesh)
      projectiles.splice(i, 1)
      if (enemyHp <= 0) {
        enemyDefeated = true
        enemy.visible = false
        document.querySelector('#enemy-status')!.textContent = '土偶の守護者：撃破！'
        document.querySelector('#objective')!.textContent = '遺跡の奥へ進もう'
        document.querySelector('#message')!.textContent = '扉を抜けてクリアしよう'
      } else {
        document.querySelector('#enemy-status')!.textContent = `土偶の守護者 HP：${'■'.repeat(enemyHp)}${'□'.repeat(3 - enemyHp)}`
      }
    } else if (projectile.mesh.position.length() > 80) {
      scene.remove(projectile.mesh)
      projectiles.splice(i, 1)
    }
  }
  desiredCamera.set(0, player.position.y + 5.3, 10.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y).add(player.position)
  desiredCamera.x += (Math.random() - 0.5) * screenShake
  desiredCamera.y += (Math.random() - 0.5) * screenShake
  screenShake = Math.max(0, screenShake - dt * 0.8)
  camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt))
  camera.lookAt(player.position.x, 1.25, player.position.z - 1)
  const nearSwitch = player.position.distanceTo(switchOrb.position) < 3.2
  document.querySelector('#message')!.textContent = nearSwitch && !activated ? 'Eで空気砲を使う' : activated && !enemyDefeated ? 'Space／クリックで空気砲を撃つ' : activated ? '開いた扉へ向かおう' : 'WASD / 矢印キーで移動'
  if (activated && enemyDefeated && player.position.z < -12) document.querySelector('#complete')!.classList.remove('hidden')
  document.body.dataset.playerZ = player.position.z.toFixed(2)
  document.body.dataset.activated = String(activated)
  composer.render()
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
})
animate()
