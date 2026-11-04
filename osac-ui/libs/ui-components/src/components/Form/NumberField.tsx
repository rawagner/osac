import { type ReactNode, useRef } from 'react';
import { FormGroup, NumberInput, Split, SplitItem, Stack } from '@patternfly/react-core';
import { useField } from 'formik';

import { getVisibleFieldError } from './fieldError';
import { useShowFieldValidationErrors } from './FieldValidationContext';
import { FormFieldHelper, getFormFieldHelperDescribedBy } from './FormFieldHelper';
import { useTrimmedInput } from './useTrimmedInput';

interface NumberFieldProps {
  name: string;
  label: string;
  fieldId: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  helperText?: string;
  placeholder?: string;
  labelInfo?: ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  min?: number;
  max?: number;
  step?: number;
  asFormGroup?: boolean;
}

const NumberField = ({
  name,
  label,
  fieldId,
  isRequired = false,
  isDisabled = false,
  helperText,
  placeholder,
  labelInfo,
  inputMode,
  min,
  max,
  step,
  children,
  asFormGroup = true,
}: React.PropsWithChildren<NumberFieldProps>) => {
  const [field, meta, helpers] = useField<string>(name);
  const showValidationErrors = useShowFieldValidationErrors();
  const error = getVisibleFieldError(meta, showValidationErrors);
  const validated = error ? 'error' : 'default';
  const helperDescribedBy = getFormFieldHelperDescribedBy(fieldId, error, helperText);
  const trimmedInput = useTrimmedInput(field.value, helpers.setValue);
  const valueBeforeBlur = useRef<string | undefined>(undefined);

  const handleNumberChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    const blurValue = valueBeforeBlur.current;
    valueBeforeBlur.current = undefined;
    // PatternFly calls onChange on blur, even when it only rewrites an empty input to zero.
    if (blurValue !== undefined && (blurValue === '' || value === blurValue)) {
      return;
    }
    trimmedInput.onChange(value);
  };

  const handleNumberBlurCapture = (event: React.FocusEvent<HTMLInputElement>) => {
    valueBeforeBlur.current = event.currentTarget.value;
    field.onBlur(event);
    trimmedInput.onBlur();
  };

  const adjustNumber = (direction: -1 | 1) => {
    const current = Number(field.value);
    const next = (Number.isFinite(current) ? current : 0) + direction * (step ?? 1);
    if ((min !== undefined && next < min) || (max !== undefined && next > max)) {
      return;
    }
    trimmedInput.onChange(String(next));
  };

  const numberValue =
    field.value === '' || field.value === undefined
      ? ''
      : Number.isFinite(Number(field.value))
        ? Number(field.value)
        : '';

  const content = (
    <Stack>
      <Split hasGutter>
        <SplitItem isFilled>
          <NumberInput
            value={numberValue}
            min={min}
            max={max}
            inputName={name}
            inputAriaLabel={label}
            onMinus={() => adjustNumber(-1)}
            onPlus={() => adjustNumber(1)}
            onChange={handleNumberChange}
            isDisabled={isDisabled}
            validated={validated}
            inputProps={{
              id: fieldId,
              placeholder,
              inputMode,
              min,
              max,
              step,
              onBlurCapture: handleNumberBlurCapture,
              'aria-invalid': error ? true : undefined,
              'aria-describedby': helperDescribedBy,
            }}
          />
        </SplitItem>
        {children && <SplitItem>{children}</SplitItem>}
      </Split>
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

export default NumberField;
