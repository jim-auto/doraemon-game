import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import './style.css'

type Keys = Record<string, boolean>

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div id="hud">
    <div class="brand">時空遺跡 <span>prototype 01</span></div>
    <div id="objective">遺跡のスイッチを探そう</div>
    <div id="gadget">ひみつ道具：空気砲</div>
    <div id="message">WASD / 矢印キーで移動　・　Eで調べる</div>
  </div>
  <div id="crosshair">＋</div>
  <div id="complete" class="hidden"><div>扉が開いた！</div><small>古代遺跡の奥へ進めます</small></div>
`

THREE.ColorManagement.enabled = true
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x7897a0)
scene.fog = new THREE.FogExp2(0x7897a0, 0.018)

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

scene.add(new THREE.HemisphereLight(0xafd9e1, 0x2a201c, 1.3))
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

const stoneTexture = makeTexture('#77675a', '#d0b28c', [2.5, 2.5])
const floorTexture = makeTexture('#716b57', '#b6a982', [14, 14])
const mat = (color: number, roughness = 0.85, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness, map })
const stone = mat(0xffffff, 0.92, stoneTexture)
const stoneLight = mat(0xffffff, 0.82, stoneTexture)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mat(0xffffff, 1, floorTexture))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

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

// Modular ruins: columns, lintels, broken blocks and an arched gate.
function column(x: number, z: number, height = 5, broken = false) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, height, 10), stone)
  shaft.position.set(x, height / 2, z)
  shaft.castShadow = shaft.receiveShadow = true
  scene.add(shaft)
  box([2.1, 0.35, 2.1], [x, height + 0.18, z], stoneLight)
  box([1.7, 0.25, 1.7], [x, 0.12, z], stoneLight)
  if (broken) box([1.6, 0.8, 1.2], [x + 0.55, height + 0.7, z + 0.25], stone)
}
for (let x = -18; x <= 18; x += 6) { column(x, -16, 4 + Math.random() * 2, x % 12 === 0); column(x, 16, 4.5, x % 12 !== 0) }
for (let z = -10; z <= 10; z += 6) { column(-20, z, 4.5, z % 12 === 0); column(20, z, 5, z % 12 !== 0) }
for (const p of [[-9, 1, -5], [9, 1, -5], [-9, 1, 8], [9, 1, 8], [-4, 0.7, -10], [6, 0.45, 5]] as [number, number, number][]) {
  box([2.2, 1.4, 2.2], p, stoneLight)
}
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

// Player: a simple blue adventurer placeholder.
const player = new THREE.Group()
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.2, 6, 12), mat(0x2d91c9))
body.position.y = 1.25
body.castShadow = true
player.add(body)
const face = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat(0xf4e4c9))
face.position.set(0, 1.75, -0.3)
face.scale.set(1, 0.9, 0.65)
face.castShadow = true
player.add(face)
player.position.set(0, 0, 11)
scene.add(player)

const switchBase = box([1.5, 0.35, 1.5], [0, 0.2, 1], stoneLight)
const switchOrb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(0x55e6d1, 0.35))
switchOrb.position.set(0, 1, 1)
switchOrb.castShadow = true
scene.add(switchOrb)

const door = box([5, 5, 0.8], [0, 2.5, -15], stone)
let activated = false
const keys: Keys = {}
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') interact() })
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })

function interact() {
  if (player.position.distanceTo(switchOrb.position) < 3.2 && !activated) {
    activated = true
    switchBase.material = mat(0x4fe3bf)
    switchOrb.material = mat(0xffd45c, 0.3)
    door.position.y = -3
    document.querySelector('#objective')!.textContent = '遺跡の奥へ進もう'
    document.querySelector('#message')!.textContent = '空気砲でスイッチが反応した！　開いた扉へ向かおう'
  }
}

const clock = new THREE.Clock()
const desiredCamera = new THREE.Vector3()
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
    player.rotation.y = Math.atan2(direction.x, direction.z)
  }
  switchOrb.rotation.y += dt * 1.5
  desiredCamera.set(player.position.x, player.position.y + 6.5, player.position.z + 9)
  camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt))
  camera.lookAt(player.position.x, 1.1, player.position.z - 1)
  const nearSwitch = player.position.distanceTo(switchOrb.position) < 3.2
  document.querySelector('#message')!.textContent = nearSwitch && !activated ? 'Eで空気砲を使う' : activated ? '開いた扉へ向かおう' : 'WASD / 矢印キーで移動'
  if (activated && player.position.z < -12) document.querySelector('#complete')!.classList.remove('hidden')
  composer.render()
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
})
animate()
