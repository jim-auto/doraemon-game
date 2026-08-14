import * as THREE from 'three'
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

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x9fc8d0)
scene.fog = new THREE.Fog(0x9fc8d0, 24, 85)

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 150)
camera.position.set(0, 7, 11)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(0xcde8eb, 0x5f4939, 2.2))
const sun = new THREE.DirectionalLight(0xffe3b0, 3)
sun.position.set(-12, 18, 8)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
scene.add(sun)

const mat = (color: number, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness })
const stone = mat(0x806f61)
const stoneLight = mat(0xb39b7a)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mat(0x847b68))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

function box(size: [number, number, number], position: [number, number, number], material = stone) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

// A small, original temple-like play space made from primitives.
for (let x = -18; x <= 18; x += 6) {
  box([3.5, 3.5, 2], [x, 1.75, -16], stone)
  box([3.5, 3.5, 2], [x, 1.75, 16], stone)
}
for (let z = -10; z <= 10; z += 6) {
  box([2, 3.5, 3.5], [-20, 1.75, z], stone)
  box([2, 3.5, 3.5], [20, 1.75, z], stone)
}
for (const p of [[-9, 1, -5], [9, 1, -5], [-9, 1, 8], [9, 1, 8], [0, 1, -11]] as [number, number, number][]) {
  box([2, 2, 2], p, stoneLight)
}

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
  renderer.render(scene, camera)
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight) })
animate()
