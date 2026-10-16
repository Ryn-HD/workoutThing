#!/usr/bin/env python3
"""Generate the VelociReps Log Workout Shortcut; sign on macOS with `shortcuts sign`.

Eleven actions, counting the comment and the if/otherwise/end-if: check the
input exists, read startDate / durationSeconds / energyKcal from the JSON
text, Log Workout, show an alert. Parameter keys
(WFWorkoutReadableActivityType, WFWorkoutDate, WFWorkoutDuration,
WFWorkoutCaloriesQuantity) and the `s` / `kcal` unit strings come from the
ActionKit framework on macOS 26. Log Workout only runs on iPhone.
"""
import plistlib
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
actions = []


def uid(label):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'velocireps-health-v2/' + label)).upper()


def action(identifier, **parameters):
    identifier = 'is.workflow.actions.' + identifier
    action_id = uid(str(len(actions)) + identifier)
    parameters['UUID'] = action_id
    actions.append({'WFWorkflowActionIdentifier': identifier, 'WFWorkflowActionParameters': parameters})
    return {'Type': 'ActionOutput', 'OutputUUID': action_id, 'OutputName': 'Dictionary Value'}


def token(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text(*parts):
    string = ''
    attachments = {}
    for part in parts:
        if isinstance(part, dict):
            attachments['{%d, 1}' % len(string)] = part
            string += '￼'
        else:
            string += part
    return {'Value': {'string': string, 'attachmentsByRange': attachments}, 'WFSerializationType': 'WFTextTokenString'}


def quantity(value, unit):
    return {'Value': {'Magnitude': text(value), 'Unit': unit}, 'WFSerializationType': 'WFQuantityFieldValue'}


def dictionary_value(key):
    return action('getvalueforkey', WFInput=token(shortcut_input), WFDictionaryKey=key, WFGetDictionaryValueType='Value')


shortcut_input = {'Type': 'ExtensionInput'}
action('comment', WFCommentActionText='VelociReps Apple Health bridge v2. VelociReps runs this Shortcut with JSON text: startDate (ISO 8601), durationSeconds, energyKcal. It logs one Traditional Strength Training workout. Keep the name "VelociReps Log Workout".')
group = uid('input-check')
action('conditional', WFInput={'Type': 'Variable', 'Variable': token(shortcut_input)}, WFCondition=100, WFControlFlowMode=0, GroupingIdentifier=group)
action('conditional', WFControlFlowMode=1, GroupingIdentifier=group)
action('alert', WFAlertActionTitle='Use this from VelociReps', WFAlertActionMessage='Finish a workout in VelociReps. It runs this Shortcut with the workout data. Running it by itself logs nothing.', WFAlertActionCancelButtonShown=False)
action('exit')
action('conditional', WFControlFlowMode=2, GroupingIdentifier=group)
start_date = dictionary_value('startDate')
duration = dictionary_value('durationSeconds')
kcal = dictionary_value('energyKcal')
action('health.workout.log',
    WFWorkoutReadableActivityType='Traditional Strength Training',
    WFWorkoutDate=token(start_date),
    WFWorkoutDuration=quantity(duration, 's'),
    WFWorkoutCaloriesQuantity=quantity(kcal, 'kcal'))
action('alert', WFAlertActionTitle='Saved to Apple Health', WFAlertActionMessage='Switch back to VelociReps.', WFAlertActionCancelButtonShown=False)

workflow = {
    'WFWorkflowName': 'VelociReps Log Workout',
    'WFWorkflowActions': actions,
    'WFWorkflowClientVersion': '4711',
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowInputContentItemClasses': ['WFStringContentItem'],
    'WFWorkflowTypes': [],
    'WFWorkflowIcon': {'WFWorkflowIconStartColor': 2071128575, 'WFWorkflowIconGlyphNumber': 61440},
    'WFWorkflowImportQuestions': [],
}
output = ROOT / 'shortcuts' / 'VelociReps-Log-Workout.unsigned.shortcut'
output.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_XML, sort_keys=False))
print(f'Generated {len(actions)} actions: {output}')
