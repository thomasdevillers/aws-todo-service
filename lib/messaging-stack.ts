import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { EnvConfig } from './config';

interface MessageStackProps extends StackProps {
    config: EnvConfig
}

export class MessagingStack extends Stack {
    public readonly topic: sns.Topic;
    public readonly workerFn: lambda.NodejsFunction;
    public readonly dlq: sqs.Queue;

    constructor(scope: Construct, id: string, props: MessageStackProps) {
        super(scope, id, props);

        this.topic = new sns.Topic(this, 'TodoTopic', {
            topicName: 'TodoEvents',
        });

        this.dlq = new sqs.Queue(this, 'WorkerDLQ', {
            retentionPeriod: Duration.days(14),
        });

        const queue = new sqs.Queue(this, 'WorkerQueue', {
            visibilityTimeout: Duration.seconds(60),
            deadLetterQueue: {
                queue: this.dlq,
                maxReceiveCount: 3,
            },
        });

        this.topic.addSubscription(new snsSubs.SqsSubscription(queue));

        this.workerFn = new lambda.NodejsFunction(this, 'WorkerFunction', {
            entry: path.join(__dirname, '..', 'lambda', 'worker', 'handler.ts'), //resolves to root/lambda/worker/handler.ts
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.seconds(30),
            memorySize: 256,
            logRetention: props.config.logRetention,
        });

        this.workerFn.addEventSource(new eventSources.SqsEventSource(queue, {
            batchSize: 10, // process up to 5 messages at a time
            reportBatchItemFailures: true, // allows for partial batch failure handling
        }));

    }
}