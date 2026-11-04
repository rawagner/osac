import { FormGroup, Stack, TextInput } from '@patternfly/react-core';
import { useField } from 'formik';

import { getVisibleFieldError } from './fieldError';
import { useShowFieldValidationErrors } from './FieldValidationContext';
import { FormFieldHelper, getFormFieldHelperDescribedBy } from './FormFieldHelper';

const parseBigInt = (value: string): bigint | undefined => {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
};

const INTEGER_INPUT_PATTERN = /^-?\d*$/;
const INVALID_INTEGER_INPUT_KEYS = new Set(['.', ',', 'e', 'E', '+']);

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
  step?: number;
  asFormGroup?: boolean;
  type?: 'number' | 'bigint'
}

const IntegerField = ({
  name,
  label,
  fieldId,
  isRequired = false,
  isDisabled = false,
  helperText,
  placeholder,
  min,
  max,
  step,
  type = 'number',
  asFormGroup = true,
}: React.PropsWithChildren<IntegerFieldProps>) => {
  const [field, meta] = useField<number | bigint | undefined>(name);
  const showValidationErrors = useShowFieldValidationErrors();
  const error = getVisibleFieldError(meta, showValidationErrors);
  const validated = error ? 'error' : 'default';
  const helperDescribedBy = getFormFieldHelperDescribedBy(fieldId, error, helperText);

  const content = (
    <Stack>
      <TextInput
        id={fieldId}
        name={name}
        type={type === 'bigint' ? 'text' : 'number'}
        inputMode="numeric"
        value={field.value?.toString() ?? ''}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onKeyDown={(event) => {
          if (INVALID_INTEGER_INPUT_KEYS.has(event.key)) {
            event.preventDefault();
          }
        }}
        onChange={(event, value) => {
          if (!INTEGER_INPUT_PATTERN.test(value)) {
            event.currentTarget.value = field.value?.toString() ?? '';
            return;
          }

          const numericValue =
            value === '' ? undefined : type === 'bigint' ? parseBigInt(value) : Number(value);
          void field.onChange({ target: { name, value: numericValue } });
        }}
        onBlur={field.onBlur}
        isDisabled={isDisabled}
        validated={validated}
        aria-invalid={error ? true : undefined}
        aria-describedby={helperDescribedBy}
      />
      <FormFieldHelper error={error} description={helperText} fieldId={fieldId} />
    </Stack>
  );

  return asFormGroup ? (
    <FormGroup label={label} fieldId={fieldId} isRequired={isRequired}>
      {content}
    </FormGroup>
  ) : (
    content
  );
};

export default IntegerField;
