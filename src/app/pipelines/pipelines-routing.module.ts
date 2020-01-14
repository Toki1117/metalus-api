import { PipelinesEditorComponent } from './components/pipelines-editor/pipelines-editor.component';
import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';

const routes: Routes = [
	{
		path: '',
		component: PipelinesEditorComponent,
		pathMatch: 'full'
	}
];

@NgModule({
	imports: [
		RouterModule.forChild(routes)
	],
	exports: [
		RouterModule
	]
})
export class PipelinesRoutingModule {}
