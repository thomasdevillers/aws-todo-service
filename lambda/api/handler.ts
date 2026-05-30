import type { APIGatewayProxyEventV2, APIGatewayProxyResult, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const TABLE_NAME = process.env.TABLE_NAME!;
const TOPIC_ARN = process.env.TOPIC_ARN!;


// created outside the handler to take advantage of warm starts.
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});


const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
    statusCode,
    headers: {'content-type': 'application/json'},
    body:JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const route = event.routeKey;
    console.log('received event', { route, body: event.body, pathParameters: event.pathParameters });

    try {
        if (route === 'POST /todos') {
            const body = JSON.parse(event.body ?? '{}');
            if(!body.title) return json(400, {error: 'title is required'});

            const todo = {
                id: randomUUID(),
                title: body.title,
                priority: body.priority ?? 'normal',
                done: false,
                createdAt: new Date().toISOString(),
            }

            await ddb.send(new PutCommand({TableName: TABLE_NAME, Item: todo}));


            await sns.send(new PublishCommand({
                TopicArn: TOPIC_ARN,
                Message: JSON.stringify({type: 'TodoCreated', todo}),
            }));

            return json(201, todo);
        }
        if (route === 'GET /todos') {
            const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
            return json(200, result.Items ?? []);
        }

        if (route === 'GET /todos/{id}') {
            const id = event.pathParameters?.id;
            const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));
            if (!result.Item) return json(404, { error: 'not found' });
            return json(200, result.Item);
        }

        if (route === 'DELETE /todos/{id}') {
            const id = event.pathParameters?.id;
            await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
            return json(204, null);
        }

        return json(404, {error: 'not found'});
    } catch(err) {
        console.error('handler error', err);
        return json(500, {error: 'internal error'});
    }
}




