import React from "react";
import Form from "react-bootstrap/Form";
import cronstrue from "cronstrue/i18n";
import { getDeepStateProperty } from "../../utils/deepstate";
import { EffectiveValueColumn } from "./EffectiveValueColumn";

function cronLines(value) {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
}

export function EffectiveListValue(component, policyField) {
  const dsp = getDeepStateProperty(component, "resolved.definition." + policyField, undefined);
  const effective = getDeepStateProperty(component, "resolved.effective." + policyField, undefined);
  const lines = policyField === "scheduling.cron" ? cronLines(effective) : [];

  return (
    <EffectiveValueColumn>
      <Form.Group>
        <Form.Control
          data-testid={"effective-" + policyField}
          size="sm"
          as="textarea"
          rows="5"
          value={effective}
          readOnly={true}
        />
        {lines.length > 0 && (
          <ul
            data-testid={"cron-human-" + policyField}
            style={{ marginTop: "0.25rem", marginBottom: "0.25rem", paddingLeft: "1.25rem", fontSize: "0.8125rem" }}
          >
            {lines.map((line, i) => {
              try {
                return <li key={i}>{cronstrue.toString(line, { locale: "ko" })}</li>;
              } catch {
                return <li key={i} style={{ color: "#dc2626" }}>유효하지 않은 cron 식: {line}</li>;
              }
            })}
          </ul>
        )}
        <Form.Text data-testid={"definition-" + policyField}>{component.PolicyDefinitionPoint(dsp)}</Form.Text>
      </Form.Group>
    </EffectiveValueColumn>
  );
}
