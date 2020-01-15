import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { IPipeline, IPipelineResponse, IPipelinesResponse } from '../models/pipelines.model';
import { catchError, map } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class PipelinesService {
	constructor(private http: HttpClient) {}

	getPipelines(): Observable<IPipeline[]> {
		return this.http.get<IPipelinesResponse>(`/api/v1/pipelines`, { observe: 'response' }).pipe(
			map((response) => {
				if (response && response.body) {
					return response.body.pipelines.map((p) => {
						delete p['_id'];
						return p;
					});
				}
				return [];
			}),
			catchError((err) => throwError(err))
		);
	}

	addPipeline(pipeline: IPipeline): Observable<IPipeline> {
		return this.http
			.post<IPipelineResponse>('/api/v1/pipelines', pipeline, { observe: 'response' })
			.pipe(map((response) => response.body.pipeline), catchError((err) => throwError(err)));
	}

	updatePipeline(pipeline: IPipeline): Observable<IPipeline> {
		return this.http
			.put<IPipelineResponse>(`/api/v1/pipelines/${pipeline.id}`, pipeline, { observe: 'response' })
			.pipe(map((response) => response.body.pipeline), catchError((err) => throwError(err)));
	}

	deletePipeline(pipeline: IPipeline): Observable<boolean> {
		return this.http
			.delete(`/api/v1/pipelines/${pipeline.id}`, { observe: 'response' })
			.pipe(map((response) => true), catchError((err) => throwError(err)));
	}

	getPipelineSchema(): Observable<any> {
		return this.http
			.get('/schemas/pipelines.json', { observe: 'response' })
			.pipe(map((response) => response.body), catchError((err) => throwError(err)));
	}
}
