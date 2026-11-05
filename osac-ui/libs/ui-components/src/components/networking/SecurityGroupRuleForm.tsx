import { useFormikContext } from 'formik';

import { Protocol } from '@osac/types';

import { protocolToString } from './SecurityGroupRulesTable';
import { useTranslation } from '../../hooks/useTranslation';
import IntegerField from '../Form/IntegerField';
import OsacForm from '../Form/OsacForm';
import { SelectField } from '../Form/SelectField';
import TextField from '../Form/TextField';

export const showPortRange = (protocol: Protocol) =>
  protocol === Protocol.TCP || protocol === Protocol.UDP;

export interface RuleFormValues {
  protocol: number;
  portFrom: number;
  portTo: number;
  ipv4Cidr: string;
}

export const SecurityGroupRuleForm = () => {
  const { t } = useTranslation();
  const { values, initialValues } = useFormikContext<RuleFormValues>();

  // ICMP is not offered: the API rejects it when a network manager lacks the ICMP capability, and All
  // includes it. A stored ICMP rule keeps its option while it is edited.
  const protocolOptions = [
    { value: Protocol.TCP, label: protocolToString(Protocol.TCP, t) },
    { value: Protocol.UDP, label: protocolToString(Protocol.UDP, t) },
    ...(initialValues.protocol === Protocol.ICMP
      ? [{ value: Protocol.ICMP, label: protocolToString(Protocol.ICMP, t) }]
      : []),
    { value: Protocol.ALL, label: protocolToString(Protocol.ALL, t) },
  ];

  return (
    <OsacForm>
      <SelectField
        name="protocol"
        label={t('Protocol')}
        fieldId="rule-protocol"
        isRequired
        options={protocolOptions}
      />

      {showPortRange(values.protocol) && (
        <>
          <IntegerField
            name="portFrom"
            label={t('Port From')}
            fieldId="rule-port-from"
            isRequired
          />
          <IntegerField name="portTo" label={t('Port To')} fieldId="rule-port-to" isRequired />
        </>
      )}

      <TextField
        name="ipv4Cidr"
        label={t('IPv4 CIDR')}
        fieldId="rule-ipv4-cidr"
        placeholder="192.168.1.0/24 or 0.0.0.0/0"
      />
    </OsacForm>
  );
};
