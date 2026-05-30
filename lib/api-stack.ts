import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';
import { EnvConfig } from './config';

interface ApiStackProps extends StackProps {
    todosTable: dynamodb.TableV2;
    topic: sns.Topic;
    config: EnvConfig;
}

export class ApiStack extends Stack {
    public readonly apiFn: lambda.NodejsFunction;
    public readonly httpApi: apigw.HttpApi;
    public readonly apiUrlOutput: CfnOutput;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        this.apiFn = new lambda.NodejsFunction(this, 'ApiFunction', {
            entry: path.join(__dirname, '..', 'lambda', 'api', 'handler.ts'), //resolves to root/lambda/api/handler.ts
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.seconds(10),
            logRetention: props.config.logRetention,
            memorySize: 256,
            environment: {
                TABLE_NAME: props.todosTable.tableName,
                TOPIC_ARN: props.topic.topicArn,
                ENV_NAME: props.config.envName,
            }
        });

        props.todosTable.grantReadWriteData(this.apiFn); // allows lambda to read and write to dynamoDB
        props.topic.grantPublish(this.apiFn); 

        this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
            apiName: `$TodoApi-${props.config.envName}`,
        });

        const integration = new integrations.HttpLambdaIntegration('ApiIntegration', this.apiFn);

        this.httpApi.addRoutes({path: '/todos', methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST], integration});
        this.httpApi.addRoutes({ path: '/todos/{id}', methods: [apigw.HttpMethod.GET, apigw.HttpMethod.DELETE], integration });

        // prints the api gateway url for ease of access
        this.apiUrlOutput = new CfnOutput(this, 'ApiUrl', {value: this.httpApi.apiEndpoint});
    }
}