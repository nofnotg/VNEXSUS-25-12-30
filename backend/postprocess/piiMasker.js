/**
 * PII Masker (T12)
 * 
 * 목적:
 * - 개인정보(PII) 보호를 위한 마스킹 기능
 * - 주민번호, 전화번호, 이름 등 민감 정보 패턴 마스킹
 */

class PIIMasker {
    constructor() {
        this.patterns = {
            // 주민등록번호: YYMMDD-NNNNNNN 또는 YYMMDD-N****** 형태
            ssn: /(\d{6})-?(\d{7})/g,

            // 전화번호: 010-XXXX-XXXX, 02-XXX-XXXX 등
            phone: /(0\d{1,2})-?(\d{3,4})-?(\d{4})/g,

            // 이메일
            email: /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
        };
    }

    /**
     * 주민등록번호 마스킹
     */
    maskSSN(text) {
        if (!text) return text;
        return text.replace(this.patterns.ssn, (match, p1, p2) => {
            return `${p1}-*******`;
        });
    }

    /**
     * 전화번호 마스킹
     */
    maskPhone(text) {
        if (!text) return text;
        return text.replace(this.patterns.phone, (match, p1, p2, p3) => {
            return `${p1}-****-${p3}`;
        });
    }

    /**
     * 이메일 마스킹
     */
    maskEmail(text) {
        if (!text) return text;
        return text.replace(this.patterns.email, (match, p1, p2) => {
            const maskedUser = p1.length > 2 ? p1.substring(0, 2) + '***' : '***';
            return `${maskedUser}@${p2}`;
        });
    }

    /**
     * 이름 마스킹 (한글 이름 가운데 글자 마스킹)
     */
    maskName(name) {
        if (!name || name.length < 2) return name;

        if (name.length === 2) {
            return name[0] + '*';
        } else if (name.length === 3) {
            return name[0] + '*' + name[2];
        } else {
            // 4글자 이상인 경우 가운데 글자들 마스킹
            return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
        }
    }

    /**
     * 모든 PII 마스킹 적용
     */
    maskAll(text, options = {}) {
        if (!text) return text;

        let masked = text;

        if (options.maskSSN !== false) {
            masked = this.maskSSN(masked);
        }

        if (options.maskPhone !== false) {
            masked = this.maskPhone(masked);
        }

        if (options.maskEmail !== false) {
            masked = this.maskEmail(masked);
        }

        return masked;
    }

    /**
     * 환자 정보 객체 마스킹
     */
    maskPatientInfo(patientInfo, options = {}) {
        if (!patientInfo) return patientInfo;

        const masked = { ...patientInfo };

        // 이름 마스킹
        if (masked.name && options.maskName !== false) {
            masked.name = this.maskName(masked.name);
        }

        // 주민번호 마스킹
        if (masked.ssn) {
            masked.ssn = this.maskSSN(masked.ssn);
        }

        // 전화번호 마스킹
        if (masked.phone) {
            masked.phone = this.maskPhone(masked.phone);
        }

        // 이메일 마스킹
        if (masked.email) {
            masked.email = this.maskEmail(masked.email);
        }

        return masked;
    }
}

export default new PIIMasker();
