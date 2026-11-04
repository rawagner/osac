import { FormSection, Stack, StackItem, Title } from '@patternfly/react-core';

import { useTranslation } from '../../../../hooks/useTranslation';
import IntegerField from '../../../Form/IntegerField';
import OsacForm from '../../../Form/OsacForm';
import TextField from '../../../Form/TextField';
const CpuMemoryStep = () => {
  const { t } = useTranslation();
  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h2" size="lg">
          {t('CPU & Memory')}
        </Title>
      </StackItem>
      <StackItem>
        <OsacForm>
          <FormSection title={t('CPU')}>
            <IntegerField
              name="spec.cpu.cores"
              label={t('Cores')}
              fieldId="baremetal-instance-type-cpu-cores"
              isRequired
              min={1}
              step={1}
            />
            <TextField
              name="spec.cpu.architecture"
              label={t('Architecture')}
              fieldId="baremetal-instance-type-cpu-architecture"
              isRequired
              placeholder={t('e.g. x86_64, aarch64')}
            />
            <TextField
              name="spec.cpu.model"
              label={t('Model')}
              fieldId="baremetal-instance-type-cpu-model"
            />
            <IntegerField
              name="spec.cpu.threadsPerCore"
              label={t('Threads per core')}
              fieldId="baremetal-instance-type-cpu-threads-per-core"
              isRequired
              min={1}
              step={1}
            />
          </FormSection>
          <FormSection title={t('Memory')}>
            <IntegerField
              name="spec.memory.totalGb"
              label={t('Total (GB)')}
              fieldId="baremetal-instance-type-memory-total"
              isRequired
              min={1}
              step={1}
              type="bigint"
            />
            <TextField
              name="spec.memory.type"
              label={t('Type')}
              fieldId="baremetal-instance-type-memory-type"
              placeholder={t('e.g. DDR4, DDR5')}
            />
          </FormSection>
        </OsacForm>
      </StackItem>
    </Stack>
  );
};

export default CpuMemoryStep;
