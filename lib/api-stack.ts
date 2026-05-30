import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';

interface ApiStackProps extends StackProps {
    todosTable: dynamodb.TableV2,
    topic: sns.Topic
}

export class ApiStack extends Stack {
    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const apiFn = new lambda.NodejsFunction(this, 'ApiFunction', {
            entry: path.join(__dirname, '..', 'lambda', 'api', 'handler.ts'), //resolves to root/lambda/api/handler.ts
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.seconds(10),
            memorySize: 256,
            environment: {
                TABLE_NAME: props.todosTable.tableName,
                TOPIC_ARN: props.topic.topicArn,
            }
        });

        props.todosTable.grantReadWriteData(apiFn); // allows lambda to read and write to dynamoDB
        props.topic.grantPublish(apiFn); 

        const httpApi = new apigw.HttpApi(this, 'HttpApi', {
            apiName: 'TodoApi',
        });

        const integration = new integrations.HttpLambdaIntegration('ApiIntegration', apiFn);

        httpApi.addRoutes({path: '/todos', methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST], integration});
        httpApi.addRoutes({ path: '/todos/{id}', methods: [apigw.HttpMethod.GET, apigw.HttpMethod.DELETE], integration });

        // prints the api gateway url for ease of access
        new CfnOutput(this, 'ApiUrl', {value: httpApi.apiEndpoint});

    }
}