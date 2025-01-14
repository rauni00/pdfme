import FormRender, { useForm } from 'form-render';
import React, { useContext, useEffect } from 'react';
import type { ChangeSchemaItem, Dict, SchemaForUI, PropPanelWidgetProps, PropPanelSchema } from '@pdfme/common';
import type { SidebarProps } from '../../../../types';
import { MenuOutlined } from '@ant-design/icons';
import { I18nContext, PluginsRegistry, OptionsContext } from '../../../../contexts';
import { getSidebarContentHeight } from '../../../../helper';
import { theme, Typography, Button, Divider } from 'antd';
import AlignWidget from './AlignWidget';
import WidgetRenderer from './WidgetRenderer';
import ButtonGroupWidget from './ButtonGroupWidget';
import { InternalNamePath, ValidateErrorEntity } from "rc-field-form/es/interface";

const { Text } = Typography;

type DetailViewProps = Pick<SidebarProps,
  'size' | 'schemas' | 'pageSize' | 'changeSchemas' | 'activeElements' | 'deselectSchema'
> & {
  activeSchema: SchemaForUI;
};

const DetailView = (props: DetailViewProps) => {
  const { token } = theme.useToken();

  const { size, changeSchemas, deselectSchema, activeSchema } = props;
  const form = useForm();

  const i18n = useContext(I18nContext);
  const pluginsRegistry = useContext(PluginsRegistry);
  const options = useContext(OptionsContext);

  useEffect(() => {
    const values: any = { ...activeSchema };
    // [position] Change the nested position object into a flat, as a three-column layout is difficult to implement
    values.x = values.position.x;
    values.y = values.position.y;
    delete values.position;
    form.setValues(values);

  }, [activeSchema, form]);


  const handleWatch = (formSchema: any) => {
    const formAndSchemaValuesDiffer = (formValue: any, schemaValue: any): boolean => {
      if (typeof formValue === 'object') {
        return JSON.stringify(formValue) !== JSON.stringify(schemaValue);
      }
      return formValue !== schemaValue;
    }

    let changes: ChangeSchemaItem[] = [];
    for (let key in formSchema) {
      if (['id', 'content'].includes(key)) continue;

      let value = formSchema[key];
      let changed = false;

      if (['x', 'y'].includes(key)) {
        // [position] Return the flattened position to its original form.
        changed = value !== (activeSchema as any)['position'][key];
        key = 'position.' + key;
      } else {
        changed = formAndSchemaValuesDiffer(value, (activeSchema as any)[key]);
      }

      if (changed) {
        // FIXME memo: https://github.com/pdfme/pdfme/pull/367#issuecomment-1857468274
        if (value === null && ['rotate', 'opacity'].includes(key)) value = undefined;

        changes.push({ key, value, schemaId: activeSchema.id });
      }
    }

    if (changes.length) {
      // Only commit these schema changes if they have passed form validation
      form.validateFields()
        .then(() => changeSchemas(changes))
        .catch((reason: ValidateErrorEntity) => {
          if (reason.errorFields.length) {
            changes = changes.filter((change: ChangeSchemaItem) => !reason.errorFields.find((field: {
              name: InternalNamePath;
              errors: string[];
            }) => field.name.includes(change.key)
            ));
          }
          if (changes.length) {
            changeSchemas(changes);
          }
        });
    }
  };

  const activePlugin = Object.values(pluginsRegistry).find(
    (plugin) => plugin?.propPanel.defaultSchema.type === activeSchema.type
  )!;

  const activePropPanelSchema = activePlugin?.propPanel.schema;
  if (!activePropPanelSchema) {
    console.error(`[@pdfme/ui] No propPanel.schema for ${activeSchema.type}.
Check this document: https://pdfme.com/docs/custom-schemas`);
  }

  const typeOptions = Object.entries(pluginsRegistry).map(([label, value]) => ({
    label,
    value: value?.propPanel.defaultSchema.type,
  }));
  const defaultSchema = activePlugin.propPanel.defaultSchema;

  const propPanelSchema: PropPanelSchema = {
    type: 'object',
    column: 2,
    properties: {
      type: {
        title: i18n('type'),
        type: 'string',
        widget: 'select',
        props: { options: typeOptions },
        required: true,
        span: 12,
      },
      key: { title: i18n('fieldName'), type: 'string', required: true, span: 12 },
      '-': { type: 'void', widget: 'Divider' },
      align: { title: i18n('align'), type: 'void', widget: 'AlignWidget' },
      x: { title: 'X', type: 'number', widget: 'inputNumber', required: true, span: 8, min: 0 },
      y: { title: 'Y', type: 'number', widget: 'inputNumber', required: true, span: 8, min: 0 },
      rotate: {
        title: i18n('rotate'),
        type: 'number',
        widget: 'inputNumber',
        disabled: defaultSchema?.rotate === undefined,
        max: 360,
        props: { min: 0 },
        span: 8,
      },
      width: {
        title: i18n('width'),
        type: 'number',
        widget: 'inputNumber',
        required: true,
        span: 8,
        props: { min: 0 },
      },
      height: {
        title: i18n('height'),
        type: 'number',
        widget: 'inputNumber',
        required: true,
        span: 8,
        props: { min: 0 },
      },
      opacity: {
        title: i18n('opacity'),
        type: 'number',
        widget: 'inputNumber',
        disabled: defaultSchema?.opacity === undefined,
        props: { step: 0.1, min: 0, max: 1 },
        span: 8,
      },
    },
  };

  if (typeof activePropPanelSchema === 'function') {
    const apps =
      activePropPanelSchema({
        ...props,
        options,
        theme: token,
        i18n: i18n as (key: keyof Dict | string) => string,
      }) || {};
    propPanelSchema.properties = {
      ...propPanelSchema.properties,
      ...(Object.keys(apps).length === 0 ? {} : { '--': { type: 'void', widget: 'Divider' } }),
      ...apps,
    };
  } else {
    const apps = activePropPanelSchema || {};
    propPanelSchema.properties = {
      ...propPanelSchema.properties,
      ...(Object.keys(apps).length === 0 ? {} : { '--': { type: 'void', widget: 'Divider' } }),
      ...apps,
    };
  }

  const allWidgets: {
    [key: string]: (props: PropPanelWidgetProps) => React.JSX.Element;
  } = {
    AlignWidget: (p) => <AlignWidget {...p} {...props} options={options} />,
    Divider: () => (
      <Divider style={{ marginTop: token.marginXS, marginBottom: token.marginXS }} />
    ),
    ButtonGroup: (p) => <ButtonGroupWidget {...p} {...props} options={options} />,
  };
  for (const plugin of Object.values(pluginsRegistry)) {
    const widgets = plugin?.propPanel.widgets || {};
    Object.entries(widgets).forEach(([widgetKey, widgetValue]) => {
      allWidgets[widgetKey] = (p) => (
        <WidgetRenderer
          {...p}
          {...props}
          options={options}
          theme={token}
          i18n={i18n as (key: keyof Dict | string) => string}
          widget={widgetValue}
        />
      );
    });
  }

  return (
    <div>
      <div style={{ height: 40, display: 'flex', alignItems: 'center' }}>
        <Button
          style={{
            position: 'absolute',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={deselectSchema}
          icon={<MenuOutlined />}
        />
        <Text strong style={{ textAlign: 'center', width: '100%' }}>
          {i18n('editField')}
        </Text>
      </div>
      <Divider style={{ marginTop: token.marginXS, marginBottom: token.marginXS }} />
      <div
        style={{
          height: getSidebarContentHeight(size.height),
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <FormRender
          form={form}
          schema={propPanelSchema}
          widgets={allWidgets}
          watch={{ '#': handleWatch }}
          locale="en-US"
        />
      </div>
    </div>
  );
};

const propsAreUnchanged = (prevProps: DetailViewProps, nextProps: DetailViewProps) => {
  return JSON.stringify(prevProps.activeSchema) == JSON.stringify(nextProps.activeSchema)
};

export default React.memo(DetailView, propsAreUnchanged);
