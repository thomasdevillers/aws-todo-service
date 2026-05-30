import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { EnvConfig } from './config';

interface AlarmsStackProps extends StackProps {
    config: EnvConfig;
    apiFn: lambda.NodejsFunction;
    workerFn: lambda.NodejsFunction;
    dlq: sqs.Queue;
    httpApi: apigw.HttpApi;
    pagerEmail?: string,
    pagerPhone?: string
}

export class AlarmsStack extends Stack {
    public readonly alarmTopic: sns.Topic;

    constructor(scope: Construct, id: string, props: AlarmsStackProps){
        super(scope, id, props);

        this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
            displayName: `Todo alarms (${props.config.envName}`,
        })

        if (props.config.enablePaging){
            if(props.pagerEmail){
                this.alarmTopic.addSubscription(new snsSubs.EmailSubscription(props.pagerEmail));
            }
            if(props.pagerPhone){
                this.alarmTopic.addSubscription(new snsSubs.SmsSubscription(props.pagerPhone));
            }
        }

        const alarmAction = new cwActions.SnsAction(this.alarmTopic);

        new cw.Alarm(this, 'ApiLambdaErrors', {
            alarmName: `${props.config.envName}-ApiLambdaErrors`,
            metric: props.apiFn.metricErrors({period: Duration.minutes(5)}),
            threshold: props.config.lambdaErrorThreshold,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'API Lambda is throwing errors',
        }).addAlarmAction(alarmAction);

        new cw.Alarm(this, 'WorkerLambdaErrors', {
            alarmName: `${props.config.envName}-WorkerLambdaErrors`,
            metric: props.workerFn.metricErrors({ period: Duration.minutes(5) }),
            threshold: props.config.lambdaErrorThreshold,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'Worker Lambda is throwing errors',
        }).addAlarmAction(alarmAction);

        new cw.Alarm(this, 'DlqDepth', {
            alarmName: `${props.config.envName}-DlqHasMessages`,
            metric: props.dlq.metricApproximateNumberOfMessagesVisible({
                period: Duration.minutes(1),
                statistic: 'Maximum',
            }),
            threshold: 0,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'Worker DLQ has messages — async processing is failing',
        }).addAlarmAction(alarmAction);

        // ─── 4. API Gateway 5xx rate ────────────────────────────────────
        new cw.Alarm(this, 'Api5xxErrors', {
            alarmName: `${props.config.envName}-Api5xxErrors`,
            metric: new cw.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5xx',
                dimensionsMap: { ApiId: props.httpApi.apiId },
                statistic: 'Sum',
                period: Duration.minutes(5),
            }),
            threshold: props.config.apiErrorRateThreshold,
            evaluationPeriods: 1,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
            alarmDescription: 'API Gateway 5xx rate exceeds threshold',
        }).addAlarmAction(alarmAction);
    }
}