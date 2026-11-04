import { useTranslation } from '../../../../hooks/useTranslation';
import NumberField from '../../../Form/NumberField';
import type { ProvisioningFieldControlProps } from '../../../ProvisioningWizard/fields/provisioningFieldValue';

interface BootDiskSizeFieldProps extends ProvisioningFieldControlProps {
  fieldId?: string;
}

const BootDiskSizeField = ({
  name,
  fieldId = 'vm-boot-disk-size',
  isDisabled = false,
  isRequired = true,
  labelInfo,
}: BootDiskSizeFieldProps) => {
  const { t } = useTranslation();

  return (
    <NumberField
      name={name}
      label={t('Boot disk size')}
      fieldId={fieldId}
      isRequired={isRequired}
      isDisabled={isDisabled}
      labelInfo={labelInfo}
      helperText={t('Size in GiB')}
    />
  );
};

export default BootDiskSizeField;
