import { FormGroup, Stack, TextInput } from '@patternfly/react-core';
import { useField } from 'formik';

import { INT32_MAX } from '@osac/ui-components/validation/number';

import { getVisibleFieldError } from './fieldError';
import { useShowFieldValidationErrors } from './FieldValidationContext';
import { FormFieldHelper, getFormFieldHelperDescribedBy } from './FormFieldHelper';

const NON_NEGATIVE_INTEGER_INPUT_PATTERN = /^\d*$/;
const INVALID_INTEGER_INPUT_KEYS = new Set(['-', '.', ',', 'e', 'E', '+']);

interface IntegerFieldProps {
  name: string;
  label: string;
  fieldId: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  helperText?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  asFormGroup?: boolean;
  labelInfo?: React.ReactNode;
}

const IntegerField = ({
  name,
  label,
  fieldId,
  isRequired = false,
  isDisabled = false,
  helperText,
  placeholder,
  min = 0,
  max = INT32_MAX,
  asFormGroup = true,
  labelInfo,
}: React.PropsWithChildren<IntegerFieldProps>) => {
  const [field, meta, helpers] = useField<number | undefined>(name);
  const showValidationErrors = useShowFieldValidationErrors();
  const error = getVisibleFieldError(meta, showValidationErrors);
  const helperDescribedBy = getFormFieldHelperDescribedBy(fieldId, error, helperText);
  const minimum = Math.max(min, 0);
  const maximum = Math.min(max, INT32_MAX);

  const content = (
    <Stack>
      <TextInput
        id={fieldId}
        name={name}
        type="number"
        inputMode="numeric"
        value={field.value?.toString() ?? ''}
        placeholder={placeholder}
        min={minimum}
        max={maximum}
        onKeyDown={(event) => {
          if (INVALID_INTEGER_INPUT_KEYS.has(event.key)) {
            event.preventDefault();
          }
        }}
        onChange={(_event, value) => {
          if (!NON_NEGATIVE_INTEGER_INPUT_PATTERN.test(value)) {
            return;
          }
          void helpers.setValue(value === '' ? undefined : Number(value));
        }}
        onBlur={field.onBlur}
        isDisabled={isDisabled}
        validated={error ? 'error' : 'default' }
        aria-invalid={error ? true : undefined}
        aria-describedby={helperDescribedBy}
      />
      <FormFieldHelper error={error} description={helperText} fieldId={fieldId} />
    </Stack>
  );

  return asFormGroup ? (
    <FormGroup label={label} fieldId={fieldId} isRequired={isRequired} labelInfo={labelInfo}>
      {content}
    </FormGroup>
  ) : (
    content
  );
};

export default IntegerField;
