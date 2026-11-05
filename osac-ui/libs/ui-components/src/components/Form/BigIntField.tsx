import { FormGroup, Stack, TextInput } from '@patternfly/react-core';
import { useField } from 'formik';

import { getVisibleFieldError } from './fieldError';
import { useShowFieldValidationErrors } from './FieldValidationContext';
import { FormFieldHelper, getFormFieldHelperDescribedBy } from './FormFieldHelper';

const NON_NEGATIVE_BIGINT_INPUT_PATTERN = /^\d*$/;
const INVALID_BIGINT_INPUT_KEYS = new Set(['-', '.', ',', 'e', 'E', '+']);

interface BigIntFieldProps {
  name: string;
  label: string;
  fieldId: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  helperText?: string;
  placeholder?: string;
  asFormGroup?: boolean;
  labelInfo?: React.ReactNode;
}

const BigIntField = ({
  name,
  label,
  fieldId,
  isRequired = false,
  isDisabled = false,
  helperText,
  placeholder,
  asFormGroup = true,
  labelInfo,
}: BigIntFieldProps) => {
  const [field, meta, helpers] = useField<bigint | undefined>(name);
  const showValidationErrors = useShowFieldValidationErrors();
  const error = getVisibleFieldError(meta, showValidationErrors);
  const helperDescribedBy = getFormFieldHelperDescribedBy(fieldId, error, helperText);

  const content = (
    <Stack>
      <TextInput
        id={fieldId}
        name={name}
        type="text"
        inputMode="numeric"
        value={field.value?.toString() ?? ''}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (INVALID_BIGINT_INPUT_KEYS.has(event.key)) {
            event.preventDefault();
          }
        }}
        onChange={(_event, value) => {
          if (!NON_NEGATIVE_BIGINT_INPUT_PATTERN.test(value)) {
            return;
          }
          void helpers.setValue(value === '' ? undefined : BigInt(value));
        }}
        onBlur={field.onBlur}
        isDisabled={isDisabled}
        validated={error ? 'error' : 'default'}
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

export default BigIntField;
