import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CloudWatchOmniHandsonStack } from '../lib/cloudwatch-omni-handson-stack.ts';

test('the function delivers JSON logs to its explicitly retained, writable log group', () => {
  const template = Template.fromStack(new CloudWatchOmniHandsonStack(new App(), 'TestStack'));
  template.resourceCountIs('AWS::Lambda::Function', 1);
  const groups = template.findResources('AWS::Logs::LogGroup');
  assert.equal(Object.keys(groups).length, 1);
  const groupId = Object.keys(groups)[0];
  assert.equal(groups[groupId].Properties.RetentionInDays, 7);
  assert.equal(groups[groupId].DeletionPolicy, 'Delete');
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs24.x',
    ReservedConcurrentExecutions: 1,
    LoggingConfig: { LogFormat: 'JSON', LogGroup: { Ref: groupId }, ApplicationLogLevel: 'INFO', SystemLogLevel: 'WARN' },
  });
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({
      Effect: 'Allow',
      Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: { 'Fn::GetAtt': [groupId, 'Arn'] },
    })]) },
  });
  for (const role of Object.values(template.findResources('AWS::IAM::Role'))) {
    assert.equal(role.Properties.ManagedPolicyArns, undefined);
  }
});

test('the stack adds no public invocation or automatic trigger and no account-level Omni settings', () => {
  const template = Template.fromStack(new CloudWatchOmniHandsonStack(new App(), 'BoundaryStack'));
  assert.deepEqual(Object.keys(template.toJSON().Resources).map(id => template.toJSON().Resources[id].Type).sort(), [
    'AWS::IAM::Policy', 'AWS::IAM::Role', 'AWS::Lambda::Function', 'AWS::Logs::LogGroup',
  ]);
});
