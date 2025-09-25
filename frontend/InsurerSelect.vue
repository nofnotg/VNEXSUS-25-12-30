<template>
  <div class="form-group insurer-select">
    <label :for="id">{{ label }}</label>
    <select :id="id" class="form-select insurance-company" v-model="selected" required>
      <option value="" disabled>보험사 선택</option>
      <optgroup v-for="(companies, category) in insurerOptions" :key="category" :label="category">
        <option v-for="company in companies" :key="company" :value="company">
          {{ company }}
        </option>
      </optgroup>
    </select>
  </div>
</template>

<script>
export default {
  name: 'InsurerSelect',
  props: {
    value: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: '보험사'
    },
    id: {
      type: String,
      default: 'insurer-select'
    }
  },
  data() {
    return {
      insurerOptions: {},
      selected: this.value
    }
  },
  watch: {
    selected(newValue) {
      this.$emit('input', newValue)
    },
    value(newValue) {
      this.selected = newValue
    }
  },
  created() {
    this.loadInsurerOptions()
  },
  methods: {
    async loadInsurerOptions() {
      try {
        const response = await fetch('/config/insurers.json')
        const data = await response.json()
        this.insurerOptions = data
      } catch (error) {
        console.error('보험사 목록을 로드하는 중 오류가 발생했습니다:', error)
        // 기본 옵션
        this.insurerOptions = {
          '손해보험': ['삼성화재', 'DB손해보험', '현대해상'],
          '생명보험': ['삼성생명', '한화생명', '교보생명']
        }
      }
    }
  }
}
</script>

<style scoped>
.insurer-select {
  margin-bottom: 1rem;
}
</style> 