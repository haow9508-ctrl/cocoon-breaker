// ===== 认知大方向 + 方向内子领域树（v6.0）=====
// 不再使用固定 24 维度模型——认知大方向由 LLM 在诊断阶段动态识别
// 举例：用户聊到自己在学 Python → 识别"Python 编程"大方向
//       在该方向下动态生成子领域树（Python基础/Web框架/数据科学/算法思想/编程范式/类比语言）

/**
 * 子领域节点：某个认知大方向下的细分领域
 * 用三档接触程度标注（high/low/none），不再使用编造的暴露数值
 */
export interface SubfieldNode {
  id: string;          // 子领域标识（如 "python-web-frameworks"）
  name: string;        // 子领域名称（如 "Web 框架"）
  exposure: "high" | "low" | "none";  // 接触程度：high=高频 / low=偶尔 / none=未接触
}

/**
 * 认知大方向：用户既定的认知拓展方向
 * 每个方向内含一棵子领域树，标注用户已接触/未接触的子领域
 */
export interface CognitiveDirection {
  id: string;          // 方向标识（如 "python-programming"）
  name: string;        // 方向名称（如 "Python 编程"）
  subfields: SubfieldNode[];  // 该方向下的子领域树
}

// 不再有固定维度数组——方向由 LLM 在诊断时动态识别
