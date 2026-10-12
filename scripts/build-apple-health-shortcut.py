#!/usr/bin/env python3
"""Generate an auditable Apple Shortcut; sign on macOS using `shortcuts sign`.

Parameter keys and quantity/file representations checked against the installed
macOS ActionKit definitions. Health logging still requires an iPhone test.
"""
import plistlib
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
actions = []


def uid(label):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'velocireps-health-v1/' + label)).upper()


def action(identifier, **parameters):
    identifier = 'is.workflow.actions.' + identifier
    action_id = uid(str(len(actions)) + identifier)
    parameters['UUID'] = action_id
    actions.append({'WFWorkflowActionIdentifier': identifier, 'WFWorkflowActionParameters': parameters})
    return {'Type': 'ActionOutput', 'OutputUUID': action_id, 'OutputName': 'Result'}


def token(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text(*parts):
    string = ''
    attachments = {}
    for part in parts:
        if isinstance(part, dict):
            attachments['{%d, 1}' % len(string)] = part
            string += '\ufffc'
        else:
            string += part
    return {'Value': {'string': string, 'attachmentsByRange': attachments}, 'WFSerializationType': 'WFTextTokenString'}


def if_start(value, condition=100, **extra):
    group = uid('if/' + str(len(actions)))
    action('conditional', WFInput={'Type': 'Variable', 'Variable': token(value)}, WFCondition=condition, WFControlFlowMode=0, GroupingIdentifier=group, **extra)
    return group


def if_else(group):
    action('conditional', WFControlFlowMode=1, GroupingIdentifier=group)


def if_end(group):
    action('conditional', WFControlFlowMode=2, GroupingIdentifier=group)


def alert(title, message):
    action('alert', WFAlertActionTitle=title, WFAlertActionMessage=message, WFAlertActionCancelButtonShown=False)


def guard(value, condition=100, **extra):
    group = if_start(value, condition, **extra)
    if_else(group)
    alert('Cannot send this workout', 'Open VelociReps, finish a workout, and use Send to Apple Health. The supplied workout data is missing or invalid.')
    action('exit')
    if_end(group)


action('comment', WFCommentActionText='VelociReps Apple Health bridge v1. Receives only workout start, active duration, estimated kcal, and opaque retry IDs. No server requests. Retry records live in the Shortcuts folder. A pending record requires checking Health before retrying. Keep this Shortcut name unchanged.')
shortcut_input = {'Type': 'ExtensionInput'}
group = if_start(shortcut_input)
if_else(group)
alert('Use this from VelociReps', 'In VelociReps, finish a workout and tap Done & Send to Apple Health. Running this Shortcut by itself will not log anything.')
action('exit')
if_end(group)
values = {}
for key in ['version', 'exportId', 'requestId', 'activity', 'startDate', 'durationSeconds', 'energyKcal']:
    values[key] = action('getvalueforkey', WFInput=token(shortcut_input), WFDictionaryKey=key, WFGetDictionaryValueType='Value')
    guard(values[key])
    # Dictionary values are untyped in the editor. Explicit conversions select
    # numeric/text comparison parameters instead of an empty generic condition.
    if key in ['version', 'durationSeconds', 'energyKcal']:
        values[key] = action('number', WFNumberActionNumber=text(values[key]))
    else:
        values[key] = action('gettext', WFTextActionText=text(values[key]))
guard(values['version'], 4, WFNumberValue=1)
guard(values['activity'], 4, WFConditionalActionString='Traditional Strength Training')
guard(values['durationSeconds'], 2, WFNumberValue=0)
guard(values['energyKcal'], 2, WFNumberValue=-1)

# Hash again inside the Shortcut so an external caller cannot inject a file path.
file_id = action('hash', WFInput=token(values['exportId']), WFHashType='SHA256')
folder = {'fileLocation': {'relativeSubpath': '', 'WFFileLocationType': 'Shortcuts'}, 'filename': 'Documents', 'displayName': 'Shortcuts'}
path = text('velocireps-health-', file_id, '.json')
existing = action('documentpicker.open', WFFile=folder, WFGetFilePath=path, WFFileErrorIfNotFound=False)


def save_marker(status):
    content = action('gettext', WFTextActionText='{"status":"' + status + '"}')
    action('documentpicker.save', WFInput=token(content), WFFolder=folder, WFAskWhereToSave=False, WFFileDestinationPath=path, WFSaveFileOverwrite=True)


def result(status):
    output = action('gettext', WFTextActionText=text('{"exportId":"', values['exportId'], '","requestId":"', values['requestId'], '","status":"' + status + '"}'))
    action('output', WFOutput=token(output))


group = if_start(existing)
status = action('getvalueforkey', WFInput=token(existing), WFDictionaryKey='status', WFGetDictionaryValueType='Value')
status = action('gettext', WFTextActionText=text(status))
saved_group = if_start(status, 4, WFConditionalActionString='saved')
alert('Already saved to Apple Health', 'This workout was already sent. No additional workout was logged.')
result('alreadySaved')
if_end(saved_group)
menu_group = uid('retry-menu')
items = ['It is already in Health', 'I checked — send it again', 'Cancel']
action('choosefrommenu', WFControlFlowMode=0, GroupingIdentifier=menu_group, WFMenuItems=items, WFMenuPrompt='An earlier attempt may have logged this workout. Check Apple Health before choosing. Sending again can create a duplicate.')
action('choosefrommenu', WFControlFlowMode=1, GroupingIdentifier=menu_group, WFMenuItemTitle=items[0])
save_marker('saved')
result('alreadySaved')
action('choosefrommenu', WFControlFlowMode=1, GroupingIdentifier=menu_group, WFMenuItemTitle=items[1])
# Fall through to the write below only after the user explicitly checked Health.
action('choosefrommenu', WFControlFlowMode=1, GroupingIdentifier=menu_group, WFMenuItemTitle=items[2])
action('exit')
action('choosefrommenu', WFControlFlowMode=2, GroupingIdentifier=menu_group)
if_end(group)

save_marker('pending')
workout = action('health.workout.log',
    WFWorkoutReadableActivityType='Traditional Strength Training',
    WFWorkoutDate=token(values['startDate']),
    WFWorkoutDuration={'Value': {'Magnitude': text(values['durationSeconds']), 'Unit': 's'}, 'WFSerializationType': 'WFQuantityFieldValue'},
    WFWorkoutCaloriesQuantity={'Value': {'Magnitude': text(values['energyKcal']), 'Unit': 'kcal'}, 'WFSerializationType': 'WFQuantityFieldValue'})
# A cancelled permission sheet or missing write result must not mark an export saved.
guard(workout)
save_marker('saved')
alert('Saved to Apple Health', 'Your strength training workout was logged. Return to the VelociReps Home Screen app to continue.')
result('saved')

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
