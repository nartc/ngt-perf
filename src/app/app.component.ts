import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Experience } from "./experience";

@Component({
	selector: "app-root",
	standalone: true,
	template: `
		<app-experience />
	`,
	imports: [Experience],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
