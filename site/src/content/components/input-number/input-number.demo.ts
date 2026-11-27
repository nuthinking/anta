// A module preserves indentation in the Playground editor.
export default `import { InputNumber, Tag } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [opacity, setOpacity] = useState(50)

  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
      <InputNumber
        label="Opacity"
        min={0}
        max={100}
        value={opacity}
        onValueChange={(_, { value }) => setOpacity(value)}
      />
      <Tag label={opacity === null ? 'Empty' : opacity + '%'} />
    </div>
  )
}
`
