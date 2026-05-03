export async function createCateringRequest(payload) {
  await new Promise((resolve) => setTimeout(resolve, 700));

  return {
    requestId: `GP-CAT-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'NEW',
    payload,
  };
}
