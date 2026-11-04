import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { describe, expect, it } from 'vitest';

import NumberField from './NumberField';

const renderInput = (
  props: Partial<React.ComponentProps<typeof NumberField>> = {},
  initialValues: Record<string, string> = { sizeGib: '30' },
) =>
  render(
    <Formik initialValues={initialValues} onSubmit={() => undefined}>
      <NumberField name="sizeGib" label="Size (GiB)" fieldId="size-gib" {...props} />
    </Formik>,
  );

describe('NumberField', () => {
  it('forwards min, max, and step to the number input when provided', () => {
    renderInput({ min: 1, max: 16384, step: 1 });

    const input = screen.getByRole('spinbutton', { name: 'Size (GiB)' });
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '16384');
    expect(input).toHaveAttribute('step', '1');
  });

  it('renders no min, max, or step attributes when not provided', () => {
    renderInput();

    const input = screen.getByRole('spinbutton', { name: 'Size (GiB)' });
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
    expect(input).not.toHaveAttribute('step');
  });

  it('forwards inputMode to the input', () => {
    renderInput({ inputMode: 'numeric' });

    expect(screen.getByRole('spinbutton', { name: 'Size (GiB)' })).toHaveAttribute(
      'inputmode',
      'numeric',
    );
  });

  it('provides PatternFly number controls that update the field', async () => {
    const user = userEvent.setup();

    renderInput();

    await user.click(screen.getByRole('button', { name: 'Plus' }));
    expect(screen.getByRole('spinbutton', { name: 'Size (GiB)' })).toHaveValue(31);

    await user.click(screen.getByRole('button', { name: 'Minus' }));
    expect(screen.getByRole('spinbutton', { name: 'Size (GiB)' })).toHaveValue(30);
  });

  it('stores typed numeric values as strings', async () => {
    const user = userEvent.setup();

    render(
      <Formik initialValues={{ sizeGib: '' }} onSubmit={() => undefined}>
        {({ values }) => (
          <>
            <NumberField name="sizeGib" label="Size (GiB)" fieldId="size-gib" />
            <output aria-label="Formik value">{String(values.sizeGib)}</output>
          </>
        )}
      </Formik>,
    );

    await user.type(screen.getByRole('spinbutton', { name: 'Size (GiB)' }), '42');

    expect(screen.getByLabelText('Formik value')).toHaveTextContent('42');
  });

  it('keeps an empty number field empty when it loses focus', async () => {
    const user = userEvent.setup();

    renderInput({}, { sizeGib: '' });

    const input = screen.getByRole('spinbutton', { name: 'Size (GiB)' });
    await user.click(input);
    await user.tab();

    expect(input).toHaveValue(null);
  });

  it('preserves an untouched prefilled value on blur', async () => {
    const user = userEvent.setup();

    render(
      <Formik initialValues={{ sizeGib: ' 30 ' }} onSubmit={() => undefined}>
        {({ values, dirty }) => (
          <>
            <NumberField name="sizeGib" label="Size (GiB)" fieldId="size-gib" />
            <output aria-label="Formik value">{values.sizeGib}</output>
            <output aria-label="Formik dirty">{String(dirty)}</output>
          </>
        )}
      </Formik>,
    );

    const input = screen.getByRole('spinbutton', { name: 'Size (GiB)' });
    await user.click(input);
    await user.tab();

    expect(screen.getByLabelText('Formik value').textContent).toBe(' 30 ');
    expect(screen.getByLabelText('Formik dirty')).toHaveTextContent('false');
  });
});
