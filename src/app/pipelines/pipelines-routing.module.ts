import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { PipelinesEditorComponent } from './components/pipelines-editor/pipelines-editor.component';

const routes: Routes = [
  {
    component: PipelinesEditorComponent,
    path: '',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PipelinesRoutingModule {}
