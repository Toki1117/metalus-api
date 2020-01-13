import { Component, OnInit } from '@angular/core';
import { StepsService } from '../../../steps/steps.service';
import { IStep } from '../../../steps/steps.model';
import { PipelinesService } from '../../../pipelines/pipelines.service';
import { IPipeline } from '../../../pipelines/pipelines.model';
import { ApplicationsService } from '../../../applications/applications.service';
import { IApplication } from '../../../applications/applications.model';
import { PackageObjectsService } from '../../../core/package-objects/package-objects.service';
import { IPackageObject } from '../../../core/package-objects/package-objects.model';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  applicationCount: number = 0;
  pipelineCount: number = 0;
  packageObjectCount: number = 0;
  stepCount: number = 0;

  constructor(private applicationService: ApplicationsService,
              private packageObjectsService: PackageObjectsService,
              private pipelinesService: PipelinesService,
              private stepsService: StepsService) {}

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
