import { Component, OnInit } from '@angular/core';
import { StepsService } from '../../../steps/steps.service';
import { IStep } from '../../../steps/steps.model';
import { PipelinesService } from '../../../core/services/pipelines.service';
import { IPipeline } from '../../../core/models/pipelines.model';
import { ApplicationsService } from '../../../core/services/applications.service';
import { IApplication } from '../../../core/models/applications.model';
import { PackageObjectsService } from '../../../core/services/package-objects.service';
import { IPackageObject } from '../../../core/models/package-objects.model';

@Component({
	selector: 'app-landing-page',
	templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
	applicationCount: number = 0;
	pipelineCount: number = 0;
	packageObjectCount: number = 0;
	stepCount: number = 0;

	constructor(
		private applicationService: ApplicationsService,
		private packageObjectsService: PackageObjectsService,
		private pipelinesService: PipelinesService,
		private stepsService: StepsService
	) {}

	ngOnInit(): void {
		this.applicationService.getApplications().subscribe((applications: IApplication[]) => {
			this.applicationCount = applications.length;
		});

		this.packageObjectsService.getPackageObjects().subscribe((packageObjects: IPackageObject[]) => {
			this.packageObjectCount = packageObjects.length;
		});

		this.pipelinesService.getPipelines().subscribe((pipelines: IPipeline[]) => {
			this.pipelineCount = pipelines.length;
		});

		this.stepsService.getSteps().subscribe((steps: IStep[]) => {
			this.stepCount = steps.length;
		});
	}
}
