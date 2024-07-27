import { DOCUMENT } from "@angular/common";
import {
	CUSTOM_ELEMENTS_SCHEMA,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	Injector,
	afterNextRender,
	computed,
	effect,
	inject,
	input,
	signal,
	viewChild,
} from "@angular/core";
import { RxStrategyProvider } from "@rx-angular/cdk/render-strategies";
import { RxFor } from "@rx-angular/template/for";
import { RxIf } from "@rx-angular/template/if";
import {
	NgtArgs,
	NgtCanvas,
	extend,
	injectBeforeRender,
	injectLoader,
	injectStore,
} from "angular-three";
import Stats from "stats-gl";
import * as THREE from "three";
import {
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Vector3,
} from "three";
import { FontLoader, TextGeometry } from "three-stdlib";

extend(THREE);

const ROW = 30;
const BLOCK_AMOUNT = 510;
const geom = new PlaneGeometry(1, 1);
const vec = new Color();
const chars = `!"§$%&/()=?*#<>-_.:,;+0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`;
const SEGMENTS = 80;

@Component({
	selector: "app-text",
	standalone: true,
	template: `
		<ngt-group [scale]="[0.5, 0.5, 0.1]">
			<ngt-mesh #mesh [rotation]="[0, -0.5, 0]">
				<ngt-primitive *args="[geom()]" attach="geometry" />
				<ngt-mesh-standard-material color="#303030" />
			</ngt-mesh>
		</ngt-group>
	`,
	imports: [NgtArgs],
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Text {
	text = input.required<string>();
	font = injectLoader(
		() => FontLoader,
		() => "./Inter UI_Bold.json",
	);
	config = computed(() => {
		const font = this.font();
		if (!font) return null;
		return {
			font,
			size: 1,
			height: 0.5,
			curveSegments: SEGMENTS,
			bevelEnabled: false,
		};
	});
	geom = computed(() => {
		const [config, text] = [this.config(), this.text()];
		if (!config) return null;
		return new TextGeometry(text, config);
	});

	mesh = viewChild<ElementRef<Mesh>>("mesh");

	constructor() {
		const injector = inject(Injector);
		const strategyProvider = inject(RxStrategyProvider);

		afterNextRender(() => {
			effect(
				() => {
					const mesh = this.mesh()?.nativeElement;
					if (!mesh) return;

					// track
					this.text();

					strategyProvider.schedule(() => {
						const size = new Vector3();
						mesh.geometry.computeBoundingBox();
						mesh.geometry.boundingBox?.getSize(size);
						mesh.position.x = -size.x / 2;
						mesh.position.y = -size.y / 2;
					});
				},
				{ injector },
			);
		});
	}
}

@Component({
	selector: "app-block",
	standalone: true,
	template: `
		<ngt-mesh [position]="position()" [scale]="scale()" [geometry]="geometry">
			<ngt-mesh-basic-material #material />
			<app-text *rxIf="char() as text" [text]="text" />
			<!--			<app-text [text]="char()" />-->
		</ngt-mesh>
	`,
	imports: [Text, RxIf],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Block {
	position = input([0, 0, 0]);
	scale = input([1, 1, 1]);
	change = input(false);

	char = signal("");

	geometry = geom;

	material = viewChild.required<ElementRef<MeshBasicMaterial>>("material");

	setRandomChar() {
		this.char.set(chars[Math.floor(Math.random() * chars.length)]);
		const material = this.material().nativeElement;
		material.color.set("red");
	}

	constructor() {
		const injector = inject(Injector);
		afterNextRender(() => {
			effect(
				() => {
					// track
					this.change();
					// NOTE: effect schedules a microtask but this work is scheduled in the next frame
					// with setTimeout already, it's ok
					setTimeout(this.setRandomChar.bind(this), Math.random() * 1000);
				},
				{ injector, allowSignalWrites: true },
			);

			injectBeforeRender(
				() => {
					const material = this.material().nativeElement;
					material.color.lerp(vec.set("white"), 0.01);
				},
				{ injector },
			);
		});
	}
}

@Component({
	selector: "app-blocks",
	standalone: true,
	template: `
		@for (i of amount; track i) {
			<app-block
				[position]="[
					left() + (i % ROW) * size(),
					top() + Math.floor(i / ROW) * -size(),
					0,
				]"
				[scale]="[size(), size(), size()]"
				[change]="change()"
			/>
		}
	`,
	imports: [Block, RxFor],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blocks {
	amount = Array.from({ length: BLOCK_AMOUNT }, (_, i) => i);
	ROW = ROW;
	Math = Math;

	change = signal(false);

	store = injectStore();
	width = this.store.select("viewport", "width");

	size = computed(() => this.width() / ROW);
	left = computed(() => -this.width() / 2 + this.size() / 2);
	top = computed(
		() => (BLOCK_AMOUNT / ROW / 2) * this.size() - this.size() / 2,
	);

	constructor() {
		const injector = inject(Injector);
		afterNextRender(() => {
			effect(
				(onCleanup) => {
					const id = setInterval(() => {
						this.change.update((prev) => !prev);
					}, 2000);
					onCleanup(() => clearInterval(id));
				},
				{ injector },
			);
		});
	}
}

@Component({
	selector: "app-dolly",
	standalone: true,
	template: `
		<ngt-group #group>
			<ng-content />
		</ngt-group>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Dolly {
	group = viewChild.required<ElementRef<Group>>("group");

	constructor() {
		injectBeforeRender(() => {
			const group = this.group().nativeElement;
			group.position.z = 5 + Math.sin(performance.now() * 0.005) * 5;
		});
	}
}

@Component({
	standalone: true,
	template: `
		<app-dolly>
			<app-blocks />
		</app-dolly>
	`,

	imports: [Dolly, Blocks],
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Scene {
	stats = new Stats();

	constructor() {
		const document = inject(DOCUMENT);
		this.stats.dom.style.width = "100%";
		document.body.appendChild(this.stats.dom);

		const store = injectStore();
		this.stats.init(store.snapshot.gl);

		injectBeforeRender(() => {
			this.stats.update();
		});
	}
}

@Component({
	selector: "app-experience",
	standalone: true,
	template: `
		<ngt-canvas [sceneGraph]="scene" [camera]="{ position: [0, 0, 100] }" />
	`,
	imports: [NgtCanvas],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: `
		:host {
			display: block;
			height: 100dvh;
		}
	`,
})
export class Experience {
	scene = Scene;
}
