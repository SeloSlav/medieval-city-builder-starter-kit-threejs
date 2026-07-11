import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { pass, uniform, uv, wgslFn } from 'three/tsl';
import type { DayNightGrade } from '../world/dayNightPresentation.ts';
import { applyDayNightGradeUniforms, DEFAULT_DAY_NIGHT_GRADE } from './postGrade.ts';
import type { RendererBackend } from './RendererBackend.ts';

type Disposable = {
  dispose(): void;
};

type PassNodeLike = Disposable & {
  getTextureNode(name?: string): {
    add(value: unknown): unknown;
  };
};

const DEFAULT_GRADE = DEFAULT_DAY_NIGHT_GRADE;

const DAYLIGHT_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: DEFAULT_GRADE.saturation },
    contrast: { value: DEFAULT_GRADE.contrast },
    warmth: { value: DEFAULT_GRADE.warmth },
    nightBlue: { value: DEFAULT_GRADE.nightBlue },
    vignette: { value: DEFAULT_GRADE.vignette },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float warmth;
    uniform float nightBlue;
    uniform float vignette;
    varying vec2 vUv;

    vec3 adjustSaturation(vec3 color, float amount) {
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(luma), color, amount);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color = (color - 0.5) * contrast + 0.5;
      color = adjustSaturation(color, saturation);
      color = mix(color, color * vec3(1.03, 1.01, 0.97), warmth);
      color = mix(color, color * vec3(0.82, 0.9, 1.12), nightBlue);
      float distanceFromCenter = distance(vUv, vec2(0.5));
      float edge = smoothstep(0.18, 0.78, distanceFromCenter);
      color *= mix(1.0, 1.0 - vignette, edge);
      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `,
};

export type ScenePostProcessor = {
  dispose(): void;
  render(dt: number): void;
  setDayNightGrade(grade: DayNightGrade): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number): void;
};

export function createPostProcessor(
  backend: RendererBackend,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): ScenePostProcessor {
  if (backend.kind === 'webgpu') {
    return new WebGPUPostProcessor(backend.renderer as WebGPURenderer, scene, camera);
  }

  return new WebGLPostProcessor(backend.renderer as THREE.WebGLRenderer, scene, camera);
}

function applyGradeUniforms(
  uniforms: Record<string, { value: number }>,
  grade: DayNightGrade,
): void {
  applyDayNightGradeUniforms(uniforms, grade);
}

class WebGLPostProcessor implements ScenePostProcessor {
  private readonly composer: EffectComposer;
  private readonly gradePass: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.38, 0.82));
    this.gradePass = new ShaderPass(DAYLIGHT_GRADE_SHADER);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(new OutputPass());
  }

  dispose(): void {
    this.composer.dispose();
  }

  render(dt: number): void {
    this.composer.render(dt);
  }

  setDayNightGrade(grade: DayNightGrade): void {
    applyGradeUniforms(this.gradePass.uniforms, grade);
  }

  setPixelRatio(pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }
}

class WebGPUPostProcessor implements ScenePostProcessor {
  private readonly bloomPass: Disposable;
  private readonly pipeline: RenderPipeline;
  private readonly scenePass: PassNodeLike;
  private readonly gradeSaturation = uniform(DEFAULT_GRADE.saturation);
  private readonly gradeContrast = uniform(DEFAULT_GRADE.contrast);
  private readonly gradeWarmth = uniform(DEFAULT_GRADE.warmth);
  private readonly gradeNightBlue = uniform(DEFAULT_GRADE.nightBlue);
  private readonly gradeVignette = uniform(DEFAULT_GRADE.vignette);

  constructor(renderer: WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.pipeline = new RenderPipeline(renderer);
    this.scenePass = pass(scene, camera) as PassNodeLike;

    const sceneColor = this.scenePass.getTextureNode('output');
    this.bloomPass = bloom(sceneColor, 0.12, 0.38, 0.82);
    const gradeFn = wgslFn(`
      fn daylightGrade(inputColor: vec4<f32>, frameUv: vec2<f32>) -> vec4<f32> {
        let luma = dot(inputColor.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
        let saturated = mix(vec3<f32>(luma), inputColor.rgb, gradeSaturation);
        let contrasted = (saturated - vec3<f32>(0.5)) * gradeContrast + vec3<f32>(0.5);
        let warmed = mix(contrasted, contrasted * vec3<f32>(1.03, 1.01, 0.97), gradeWarmth);
        let nightTinted = mix(warmed, warmed * vec3<f32>(0.82, 0.9, 1.12), gradeNightBlue);
        let distanceFromCenter = distance(frameUv, vec2<f32>(0.5));
        let edge = smoothstep(0.18, 0.78, distanceFromCenter);
        let graded = nightTinted * mix(1.0, 1.0 - gradeVignette, edge);
        return vec4<f32>(max(graded, vec3<f32>(0.0)), inputColor.a);
      }
    `, [
      this.gradeSaturation,
      this.gradeContrast,
      this.gradeWarmth,
      this.gradeNightBlue,
      this.gradeVignette,
    ]);

    this.pipeline.outputNode = gradeFn({
      frameUv: uv(),
      inputColor: sceneColor.add(this.bloomPass),
    });
  }

  dispose(): void {
    this.pipeline.dispose();
    this.scenePass.dispose();
    this.bloomPass.dispose();
  }

  render(): void {
    this.pipeline.render();
  }

  setDayNightGrade(grade: DayNightGrade): void {
    applyDayNightGradeUniforms(
      {
        saturation: this.gradeSaturation,
        contrast: this.gradeContrast,
        warmth: this.gradeWarmth,
        nightBlue: this.gradeNightBlue,
        vignette: this.gradeVignette,
      },
      grade,
    );
  }

  setPixelRatio(): void {
    // WebGPU pass nodes size themselves from the renderer drawing buffer each frame.
  }

  setSize(): void {
    // WebGPU pass nodes size themselves from the renderer drawing buffer each frame.
  }
}
