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
scene.background = new THREE.Color(0x8eb5ad)
scene.fog = new THREE.FogExp2(0x8eb5ad, 0.016)

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

function primitiveTree(x: number, z: number, size: number) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * size, 0.35 * size, 2.8 * size, 7), mat(0x65452f, 0.95))
  trunk.position.set(x, 1.4 * size, z)
  trunk.rotation.z = (Math.random() - 0.5) * 0.18
  trunk.castShadow = true
  scene.add(trunk)
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.35 * size, 2.8 * size, 7), mat(0x3f7652, 0.92))
  leaves.position.set(x, 3.2 * size, z)
  leaves.castShadow = true
  scene.add(leaves)
  const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(1.05 * size, 2.2 * size, 7), mat(0x5d9563, 0.92))
  leaves2.position.set(x + 0.2 * size, 4.6 * size, z)
  leaves2.castShadow = true
  scene.add(leaves2)
}
for (const tree of [[-15, -6, 1.5], [15, -7, 1.8], [-16, 6, 1.4], [16, 7, 1.6], [-11, 13, 1.2], [11, 13, 1.3]] as [number, number, number][]) primitiveTree(...tree)

// An original clay-dogū altar and a glowing time-rift silhouette anchor the theme.
const dogu = new THREE.Group()
const doguBody = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 1.55, 8), mat(0xb96542, 0.88))
doguBody.position.y = 0.9
dogu.add(doguBody)
const doguHead = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), mat(0xd07a4e, 0.86))
doguHead.position.y = 1.95
doguHead.scale.set(1.15, 0.95, 0.65)
dogu.add(doguHead)
for (const x of [-0.25, 0.25]) {
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3d241f, roughness: 1 }))
  hole.position.set(x, 2.05, -0.58)
  dogu.add(hole)
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
part(new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.15, 8, 16), blue), [0, 1.28, 0])
part(new THREE.Mesh(new THREE.SphereGeometry(0.82, 20, 16), blue), [0, 2.25, -0.02], [1, 0.98, 0.95])
part(new THREE.Mesh(new THREE.SphereGeometry(0.57, 20, 14), white), [0, 2.12, -0.69], [1, 0.92, 0.36])
for (const x of [-0.23, 0.23]) {
  part(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), white), [x, 2.42, -0.72])
  part(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), black), [x, 2.42, -0.85])
}
part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), red), [0, 2.18, -0.91])
const mouth = part(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16, Math.PI), black), [0, 2.01, -0.91])
mouth.rotation.x = -Math.PI / 2
part(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), white), [0, 1.18, -0.61], [0.94, 1.05, 0.28])
const collar = part(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.095, 8, 24), red), [0, 1.78, 0])
collar.rotation.x = Math.PI / 2
part(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), gold), [0, 1.68, -0.63])
part(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.82, 0.28), blueDark), [0, 1.18, 0.63], [1, 1, 1])
const walkArms: THREE.Object3D[] = []
const walkLegs: THREE.Object3D[] = []
for (const x of [-0.82, 0.82]) {
  const arm = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.58, 6, 10), blue), [x, 1.25, 0])
  arm.rotation.z = x < 0 ? -0.22 : 0.22
  walkArms.push(arm)
  part(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), white), [x * 1.03, 0.83, -0.03])
}
for (const x of [-0.35, 0.35]) {
  const leg = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.4, 6, 10), blueDark), [x, 0.38, 0])
  walkLegs.push(leg)
  part(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), white), [x, 0.1, -0.12], [1.15, 0.65, 1.35])
}
part(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), red), [0, 1.06, 0.98])
player.position.set(0, 0, 11)
scene.add(player)

const switchBase = box([1.5, 0.35, 1.5], [0, 0.2, 1], stoneLight)
const switchOrb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(0x55e6d1, 0.35))
switchOrb.position.set(0, 1, 1)
switchOrb.castShadow = true
scene.add(switchOrb)

const door = box([5, 5, 0.8], [0, 2.5, -15], stone)
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
let lastShotAt = -Infinity
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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb9f8ff, emissive: 0x4edfff, emissiveIntensity: 5, transparent: true, opacity: 0.9 }))
  mesh.position.copy(player.position).add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(direction, 1.2)
  mesh.castShadow = true
  scene.add(mesh)
  projectiles.push({ mesh, velocity: direction.multiplyScalar(14) })
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
